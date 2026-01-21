import { eventBus } from "../../core/EventManager.js";
import { dbService } from "../../services/DbService.js";
import { ModalUtils } from "../../core/ModalUtils.js";
import { $, createEl, formatTimestamp, toDate } from "../../core/DomUtils.js";
import { ReportService } from "../../services/ReportService.js"; // <--- EKLENDİ

export class DashboardUI {
    constructor() {
        // Elementleri seçiyoruz
        this.els = {
            kasaBakiye: $('kasaBakiye'),

            // --- YENİ EKLENEN ELEMENTLER ---
            lblReceivable: $('lblTotalReceivable'), // Bekleyen Alacak ID
            lblExpense: $('lblMonthlyExpense'),     // Aylık Gider ID
            // -------------------------------

            noteArea: $('adminNoteArea'),
            noteStatus: $('noteSaveStatus'),
            kasaList: $('kasaList'),
            adminView: $('adminView'),
            modalReport: $('modalReport'),
            btnPrint: $('btnPrintReport'),
            btnConfirm: $('btnConfirmReport'),
            dateStart: $('reportStartDate'),
            dateEnd: $('reportEndDate'),
            printArea: $('printArea')
        };
        this.initSubscribers();
        this.initListeners();
    }

    initSubscribers() {
        // Kasa Bakiyesi (Mevcut)
        eventBus.subscribe('STATE_BALANCE_CHANGED', (balance) => {
            this.els.kasaBakiye.innerText = `${this.formatMoney(balance)} ₺`;
        });

        // Kasa Hareketleri (Mevcut + Yeni Hesaplama)
        eventBus.subscribe('STATE_TRANSACTIONS_CHANGED', (list) => {
            this.renderTransactions(list);
            this.calculateMonthlyExpense(list); // <--- YENİ: Gider Hesabı
        });

        // Sakinler Listesi (YENİ: Alacak Hesabı)
        // Sakinler yüklendiğinde veya güncellendiğinde (borç eklendiğinde/ödendiğinde) çalışır
        eventBus.subscribe('STATE_RESIDENTS_CHANGED', (list) => {
            this.calculateTotalReceivable(list);
        });
    }

    initListeners() {
        this.els.btnPrint.addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            this.els.dateStart.value = today;
            this.els.dateEnd.value = today;
            ModalUtils.open(this.els.modalReport);
        });

        this.els.btnConfirm.addEventListener('click', () => {
            this.handlePrintReport();
            ModalUtils.close(this.els.modalReport);
        });

        // YENİ: Not Alanı Listener'ı (Odaktan çıkınca kaydet)
        this.els.noteArea?.addEventListener('focusout', () => {
            this.handleSaveNote();
        });
    }

    // --- YENİ HESAPLAMA METODLARI ---

    // 1. Toplam Bekleyen Alacak Hesabı
    calculateTotalReceivable(residents) {
        let total = 0;
        if (residents && residents.length > 0) {
            residents.forEach(resident => {
                if (resident.borclar && resident.borclar.length > 0) {
                    resident.borclar.forEach(borc => {
                        total += parseFloat(borc.tutar || 0);
                    });
                }
            });
        }
        this.els.lblReceivable.innerText = `${this.formatMoney(total)} ₺`;
    }

    // 2. Bu Ayki Toplam Gider Hesabı (DÜZELTİLMİŞ VERSİYON)
    calculateMonthlyExpense(transactions) {
        let total = 0;
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        const currentYear = now.getFullYear();

        if (transactions && transactions.length > 0) {
            transactions.forEach(t => {
                const amount = parseFloat(t.tutar || 0);

                // Tarih kontrolü - önce timestamp, yoksa eski tarih formatı
                let isInCurrentMonth = false;
                try {
                    const tDate = toDate(t.timestamp) || toDate(t.tarih);
                    if (tDate) {
                        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                            isInCurrentMonth = true;
                        }
                    }
                } catch (e) {
                    console.warn("Tarih parse hatası:", t);
                }

                if (isInCurrentMonth) {
                    // SENARYO A: Normal bir gider (Örn: Elektrik faturası ödendi) -> TOPLA
                    if (t.tur === 'gider' && !t.is_correction) {
                        total += amount;
                    }

                    // SENARYO B: Bir giderin iptali (Örn: Elektrik faturası işlemini geri aldık)
                    // Sistem bunu 'gelir' ve 'is_correction: true' olarak kaydeder.
                    // Bu durumda bu tutarı gider toplamından DÜŞMELİYİZ.
                    else if (t.tur === 'gelir' && t.is_correction) {
                        total -= amount;
                    }

                    // NOT: t.tur === 'gider' && t.is_correction durumu (Gelir İptali)
                    // buraya dahil edilmez. Çünkü o, yanlış girilen bir aidatın silinmesidir,
                    // apartmanın operasyonel bir gideri değildir.
                }
            });
        }

        // Eksi çıkma ihtimaline karşı (çok fazla düzeltme varsa) 0'ın altına inmesin diyorsan:
        // total = Math.max(0, total); 

        this.els.lblExpense.innerText = `${this.formatMoney(total)} ₺`;
    }

    // Para formatı yardımcısı (TR Formatı: 1.500,50)
    formatMoney(amount) {
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // ... MEVCUT RENDER METODLARI AYNEN DEVAM EDİYOR ...
    renderTransactions(list) {
        this.els.kasaList.innerHTML = '';

        if (list.length === 0) {
            const emptyState = createEl('div', 'flex flex-col items-center justify-center h-full text-gray-400 py-10');
            emptyState.appendChild(createEl('i', 'fas fa-inbox text-4xl mb-2 opacity-50'));
            emptyState.appendChild(createEl('p', 'text-sm', 'Henüz işlem bulunmuyor.'));
            this.els.kasaList.appendChild(emptyState);
            return;
        }

        const fragment = document.createDocumentFragment();

        list.slice(0, 50).forEach(item => {
            const isGelir = item.tur === 'gelir';
            const isCorrection = item.is_correction;

            const li = createEl('li', 'flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0');

            const leftDiv = createEl('div', 'flex items-center gap-3');

            let iconBg = isCorrection ? 'bg-gray-100 text-gray-500' : (isGelir ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600');
            let iconClass = isCorrection ? 'fa-undo' : (isGelir ? 'fa-arrow-down' : 'fa-arrow-up');

            const iconContainer = createEl('div', `w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`);
            iconContainer.appendChild(createEl('i', `fas ${iconClass} text-sm`));

            const textDiv = createEl('div', 'flex flex-col min-w-0');
            textDiv.appendChild(createEl('span', `text-sm font-medium text-gray-900 truncate ${isCorrection ? 'text-gray-500 line-through' : ''}`, item.aciklama));
            textDiv.appendChild(createEl('span', 'text-[10px] text-gray-400', formatTimestamp(item.timestamp) || formatTimestamp(item.tarih)));

            leftDiv.appendChild(iconContainer);
            leftDiv.appendChild(textDiv);

            const amountColor = isCorrection ? 'text-gray-400 line-through' : (isGelir ? 'text-green-600' : 'text-red-600');
            const prefix = isCorrection ? '' : (isGelir ? '+' : '-');

            const amountSpan = createEl('span', `font-bold text-sm ${amountColor} whitespace-nowrap ml-2`, `${prefix}${item.tutar} ₺`);

            li.appendChild(leftDiv);
            li.appendChild(amountSpan);

            fragment.appendChild(li);
        });

        this.els.kasaList.appendChild(fragment);
    }

    async show() {
        this.els.adminView.classList.remove('hidden-view');

        // YENİ: Notu getir ve yerleştir
        try {
            const note = await dbService.getAdminNote();
            if (this.els.noteArea) {
                this.els.noteArea.value = note;
                // Eğer not uzunsa textarea yüksekliğini ayarla (opsiyonel)
                if (note.length > 50) this.els.noteArea.style.height = '6rem';
            }
        } catch (error) {
            console.error("Not yüklenemedi", error);
        }
    }

    async handlePrintReport() {
        const startVal = this.els.dateStart.value;
        const endVal = this.els.dateEnd.value;

        if (!startVal || !endVal) {
            return eventBus.publish('SHOW_TOAST', { message: "Lütfen tarih aralığı seçin", type: "warning" });
        }

        eventBus.publish('SHOW_LOADING', true);

        try {
            // Rapor servisini çağır
            await ReportService.exportToExcel(startVal, endVal);

            eventBus.publish('SHOW_LOADING', false);
            eventBus.publish('SHOW_TOAST', { message: "Rapor indirildi.", type: "success" });

        } catch (error) {
            eventBus.publish('SHOW_LOADING', false);
            console.error(error);
            // Eğer veri yoksa veya hata varsa
            eventBus.publish('SHOW_TOAST', { message: error.message || "Rapor oluşturulamadı", type: "error" });
        }
    }

    async handleSaveNote() {
        const text = this.els.noteArea.value;
        const statusEl = this.els.noteStatus;

        // UI: Kaydediliyor göster
        statusEl.innerText = "Kaydediliyor...";
        statusEl.classList.remove('opacity-0');

        try {
            await dbService.saveAdminNote(text);

            // UI: Başarılı
            statusEl.innerText = "Kaydedildi ✔";
            statusEl.classList.add('text-green-600');

            // 2 saniye sonra yazıyı gizle
            setTimeout(() => {
                statusEl.classList.add('opacity-0');
                setTimeout(() => statusEl.classList.remove('text-green-600'), 300);
            }, 2000);

        } catch (error) {
            console.error(error);
            statusEl.innerText = "Hata oluştu!";
            statusEl.classList.add('text-red-600');
        }
    }
}