import { dbService } from "../../services/DbService.js";
import { eventBus } from "../../core/EventManager.js";
import { commandManager } from "../../core/CommandManager.js";
import { DebtCommand } from "../../commands/DebtCommand.js";
import { PayDebtCommand } from "../../commands/PayDebtCommand.js";
import { ModalUtils } from "../../core/ModalUtils.js";
import { createEl, $, formatTimestamp } from "../../core/DomUtils.js";
import { ValidationService } from "../../services/ValidationService.js";

export class ResidentUI {
    constructor() {
        this.els = {
            tableBody: document.getElementById('meskenTableBody'),
            totalCount: document.getElementById('totalResidentCount'), // Yeni sayaç
            // --- ARAMA & FİLTRE ELEMENTLERİ ---
            searchInput: document.getElementById('residentSearch'),
            filterSelect: document.getElementById('residentFilter'),
            // ----------------------------------
            modalEdit: document.getElementById('modalEditMesken'),
            modalDebt: document.getElementById('modalDebt'),
            modalAdd: document.getElementById('modalAddFlat'),
            editId: document.getElementById('editMeskenId'),
            editName: document.getElementById('editSakinAdi'),
            editNo: document.getElementById('editDaireNo'),
            debtDesc: document.getElementById('debtDesc'),
            debtAmount: document.getElementById('debtAmount'),
            newName: document.getElementById('newFlatName'),
            newNo: document.getElementById('newFlatNo'),
            btnSaveEdit: document.getElementById('btnSaveMeskenEdit'),
            btnSaveDebt: document.getElementById('btnSaveDebt'),
            btnSaveNew: document.getElementById('btnSaveNewFlat'),
            btnOpenDebt: document.getElementById('btnOpenDebtModal'),
            btnOpenAdd: document.getElementById('btnOpenAddFlatModal')
        };

        // Veriyi yerel state'te tutacağız
        this.rawList = [];
        this.currentFilter = 'active'; // Varsayılan: Aktifler
        this.currentSearch = '';

        this.initListeners();
        this.initSubscribers();
    }

    initSubscribers() {
        eventBus.subscribe('STATE_RESIDENTS_CHANGED', (list) => {
            this.rawList = list; // Ham veriyi sakla
            this.applyFiltersAndRender(); // Filtrele ve çiz
        });
    }

    initListeners() {
        // --- ARAMA & FİLTRE EVENTLERİ ---
        this.els.searchInput?.addEventListener('input', (e) => {
            this.currentSearch = e.target.value.toLowerCase();
            this.applyFiltersAndRender();
        });

        this.els.filterSelect?.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.applyFiltersAndRender();
        });
        // --------------------------------

        // Tablo Tıklamaları (Mevcut kod aynen kalıyor)
        this.els.tableBody?.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-resident');
            const btnDelete = e.target.closest('.btn-delete-resident');
            const btnLink = e.target.closest('.btn-copy-link');
            const btnRestore = e.target.closest('.btn-restore-resident'); // Geri yükleme butonu için

            if (btnEdit) {
                const data = JSON.parse(decodeURIComponent(btnEdit.dataset.resident));
                this.openEditModal(data);
            }

            if (btnDelete) {
                const dbId = btnDelete.dataset.id;
                eventBus.publish('REQUEST_CONFIRM', {
                    title: "Daireyi Arşivle",
                    message: "Bu daire 'Eski Sakinler' listesine taşınacak. Emin misiniz?",
                    onConfirm: async () => {
                        eventBus.publish('SHOW_LOADING', true);
                        await dbService.archiveResident(dbId);
                        eventBus.publish('SHOW_LOADING', false);
                        eventBus.publish('SHOW_TOAST', { message: "Daire arşivlendi." });
                    }
                });
            }

            // YENİ: Arşivden Geri Yükleme
            if (btnRestore) {
                const dbId = btnRestore.dataset.id;
                eventBus.publish('REQUEST_CONFIRM', {
                    title: "Sakin Geri Yüklensin mi?",
                    message: "Bu kayıt tekrar aktif listeye alınacak.",
                    onConfirm: async () => {
                        const userPath = dbService.getUserPath(); // DbService'e basit bir update metodu eklenebilir veya buradan çağrılabilir
                        // Basitlik adına DbService'deki update fonksiyonunu kullanıyoruz:
                        await dbService.updateResident(dbId, { aktif_mi: true, arsiv_tarihi: null });
                        eventBus.publish('SHOW_TOAST', { message: "Sakin aktif edildi." });
                    }
                });
            }

            if (btnLink) {
                const urlCode = btnLink.dataset.url;
                const fullUrl = `${window.location.origin}${window.location.pathname}?id=${urlCode}`;
                navigator.clipboard.writeText(fullUrl).then(() => {
                    eventBus.publish('SHOW_TOAST', { message: "Link kopyalandı!" });
                });
            }
        });

        // Diğer buton listener'ları (Mevcut kod aynen kalıyor)
        this.els.btnSaveEdit?.addEventListener('click', () => this.handleUpdateResident());
        this.els.btnSaveDebt?.addEventListener('click', () => this.handleSaveDebt());
        this.els.btnOpenAdd?.addEventListener('click', () => ModalUtils.open(this.els.modalAdd));
        this.els.btnSaveNew?.addEventListener('click', () => this.handleAddResident());
        this.els.btnOpenDebt?.addEventListener('click', () => ModalUtils.open(this.els.modalDebt));

        const editDebtList = document.getElementById('editBorcList');
        if (editDebtList) {
            editDebtList.addEventListener('click', (e) => {
                const btnPay = e.target.closest('.btn-pay-single-debt');
                if (btnPay) {
                    const debtData = JSON.parse(decodeURIComponent(btnPay.dataset.debt));
                    const residentId = this.els.editId.value;
                    this.handlePayDebt(residentId, debtData);
                }
            });
        }

        this.els.modalAdd?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleAddResident(); });
        this.els.modalEdit?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleUpdateResident(); });
        this.els.modalDebt?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSaveDebt(); });

        // Daire numarası alanlarına sadece rakam girilmesini zorunlu kıl (Nokta, virgül ve harfleri siler)
        const enforceNumbersOnly = (e) => {
            // Rakam olmayan her şeyi sil
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        };

        this.els.newNo?.addEventListener('input', enforceNumbersOnly);
        this.els.editNo?.addEventListener('input', enforceNumbersOnly);
    }

    // YENİ: Filtreleme Mantığı
    applyFiltersAndRender() {
        if (!this.rawList) return;

        let filtered = this.rawList.filter(item => {
            // 1. Arama Filtresi
            const searchMatch =
                item.sakin_adi.toLowerCase().includes(this.currentSearch) ||
                item.kod.toString().includes(this.currentSearch);

            if (!searchMatch) return false;

            // 2. Kategori Filtresi
            const isActive = item.aktif_mi !== false; // undefined ise de true sayalım
            const hasDebt = item.borclar && item.borclar.length > 0;

            switch (this.currentFilter) {
                case 'active': return isActive;
                case 'debt': return isActive && hasDebt;
                case 'archived': return !isActive;
                case 'all': return true;
                default: return isActive;
            }
        });

        // Sayacı güncelle
        if (this.els.totalCount) this.els.totalCount.innerText = `Toplam: ${filtered.length} Kayıt`;

        this.renderTable(filtered);
    }

    // --- MOBİL UYUMLU VE GÜVENLİ RENDER ---
    renderTable(list) {
        if (!this.els.tableBody) return;
        this.els.tableBody.innerHTML = '';

        if (list.length === 0) {
            // ... (Boş durum kodu aynı) ...
            this.els.tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">Kayıt bulunamadı.</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        list.forEach(m => {
            // 1. XSS KORUMASI: Verileri temizle
            // Eğer veritabanında zararlı kod varsa, burada zararsız metne dönüşür.
            const safeName = ValidationService.sanitize(m.sakin_adi);
            const safeNo = ValidationService.sanitize(m.kod);

            // ... (Hesaplamalar aynı) ...
            const hasDebt = m.borclar && m.borclar.length > 0;
            const isArchived = m.aktif_mi === false;
            const debtAmount = hasDebt ? m.borclar.reduce((a, b) => a + parseFloat(b.tutar), 0) : 0;

            // Durum Renkleri (Badge'ler HTML olduğu için innerHTML güvenlidir, veri içermez)
            let statusBadge = '';
            if (isArchived) statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Arşivli</span>`;
            else if (hasDebt) statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Borçlu (${debtAmount}₺)</span>`;
            else statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Temiz</span>`;

            const jsonStr = encodeURIComponent(JSON.stringify(m));

            const tr = createEl('tr', 'group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0');

            // DİKKAT: Aşağıda değişken olarak safeName ve safeNo kullanıyoruz.
            tr.innerHTML = `
                <td class=" p-4 whitespace-nowrap">
                    <div class="flex items-center">
                         <div class="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-100">
                            ${safeNo}
                        </div>
                    </div>
                </td>
                <td class="p-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-slate-900">${safeName}</div>
                    <div class="text-xs text-slate-500">Mesken</div>
                </td>
                <td class="p-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="p-4 whitespace-nowrap text-right text-sm font-medium">
                     <div class="flex justify-end gap-2">
                        ${this.getActionButtonsHTML(m, jsonStr, isArchived)}
                     </div>
                </td>
            `;

            fragment.appendChild(tr);
        });

        this.els.tableBody.appendChild(fragment);
    }

    // HTML String olarak butonları dönen yardımcı fonksiyon
    getActionButtonsHTML(m, jsonStr, isArchived) {
        if (isArchived) {
            return `<button class="btn-restore-resident p-2 text-slate-400 hover:text-green-600 transition" data-id="${m.dbId}" title="Geri Yükle"><i class="fas fa-trash-restore-alt"></i></button>`;
        }
        return `
            <button class="btn-copy-link p-2 text-slate-400 hover:text-indigo-600 transition bg-white border border-slate-200 rounded-lg shadow-sm" data-url="${m.mesken_url}" title="Link Kopyala"><i class="fas fa-link"></i></button>
            <button class="btn-edit-resident p-2 text-slate-400 hover:text-blue-600 transition bg-white border border-slate-200 rounded-lg shadow-sm" data-resident="${jsonStr}" title="Düzenle"><i class="fas fa-pen"></i></button>
            <button class="btn-delete-resident p-2 text-slate-400 hover:text-red-600 transition bg-white border border-slate-200 rounded-lg shadow-sm" data-id="${m.dbId}" title="Arşivle"><i class="fas fa-archive"></i></button>
        `;
    }

    // Yardımcı Buton Oluşturucu
    createIconBtn(className, iconClass, colorClass) {
        const btn = createEl('button', `${className} p-2 rounded transition ${colorClass}`);
        const i = createEl('i', `fas ${iconClass}`);
        btn.appendChild(i);
        return btn;
    }

    // Modal açma, ekleme, güncelleme vb. diğer fonksiyonlar aynen kalıyor...
    openEditModal(data) { /* ...Eski kod... */
        // NOT: openEditModal içinde this.els.modalEdit kontrolünü yapın, eski kodunuzda vardı
        if (!this.els.modalEdit) return;
        this.els.editId.value = data.dbId;
        this.els.editName.value = data.sakin_adi;
        this.els.editNo.value = data.kod;

        const listContainer = document.getElementById('editBorcList');
        if (listContainer) {
            listContainer.innerHTML = '';
            if (data.borclar && data.borclar.length > 0) {
                data.borclar.forEach(borc => {
                    const jsonDebt = encodeURIComponent(JSON.stringify(borc));
                    const displayDate = formatTimestamp(borc.timestamp) || formatTimestamp(borc.tarih);
                    listContainer.innerHTML += `
                        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm mb-2">
                            <div><div class="font-medium text-slate-900">${borc.aciklama}</div><div class="text-xs text-slate-500">${displayDate}</div></div>
                            <div class="flex items-center gap-3"><span class="font-bold text-red-600">${borc.tutar} ₺</span><button class="btn-pay-single-debt bg-green-100 hover:bg-green-200 text-green-700 text-xs px-3 py-1.5 rounded-md font-medium transition" data-debt="${jsonDebt}">Tahsil Et</button></div>
                        </div>`;
                });
            } else {
                listContainer.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">Bu dairenin borcu bulunmuyor.</p>';
            }
        }
        ModalUtils.open(this.els.modalEdit);
    }

    async handleAddResident() {
        const ad = this.els.newName?.value;
        const no = this.els.newNo?.value;
        if (!ad || !no) return eventBus.publish('SHOW_TOAST', { message: "Tüm alanları doldurun", type: "error" });

        eventBus.publish('SHOW_LOADING', true);
        try {
            await dbService.addResident(ad, no);
            ModalUtils.close(this.els.modalAdd);
            this.els.newName.value = "";
            this.els.newNo.value = "";
            eventBus.publish('SHOW_TOAST', { message: "Daire başarıyla eklendi", type: "success" });
        } catch (error) {
            console.error(error);
            // Hata mesajını kullanıcıya göster (Örn: "Daire No zaten kayıtlı")
            eventBus.publish('SHOW_TOAST', { message: error.message, type: "error" });
        } finally {
            eventBus.publish('SHOW_LOADING', false);
        }
    }

    async handleUpdateResident() { /* ...Eski kod... */
        const id = this.els.editId.value;
        const ad = this.els.editName.value;
        const no = this.els.editNo.value;
        await dbService.updateResident(id, { sakin_adi: ad, kod: no });
        ModalUtils.close(this.els.modalEdit);
        eventBus.publish('SHOW_TOAST', { message: "Güncellendi" });
    }

    async handleSaveDebt() {
        // DİKKAT: Toplu borç eklerken ARŞİVLİ olanlara borç eklenmemeli.
        // Buton ID'lerini DOM'dan çekiyoruz ama o an tabloda sadece filtrelenenler olabilir.
        // Daha güvenli yol: Store'daki aktif kullanıcılara eklemektir.

        const desc = this.els.debtDesc.value;
        const amount = this.els.debtAmount.value;
        if (!desc || !amount) return;

        // Ekranda görünen "silme" butonlarının ID'lerini alırsak, filtreli listeye borç eklemiş oluruz.
        // İstenen: Sadece Aktiflere ekle.

        // Bu yüzden burada DOM yerine Store'dan veri çekmek daha mantıklı ama mevcut yapınızda
        // DOM'dan çekiyordunuz. Şöyle güncelleyelim:

        const activeResidents = this.rawList.filter(r => r.aktif_mi !== false);
        const targetIds = activeResidents.map(r => r.dbId);

        if (targetIds.length === 0) return eventBus.publish('SHOW_TOAST', { message: "Borçlandırılacak aktif daire yok.", type: "warning" });

        eventBus.publish('SHOW_LOADING', true);
        const cmd = new DebtCommand(targetIds, { aciklama: desc, tutar: amount });
        await commandManager.execute(cmd);

        eventBus.publish('SHOW_LOADING', false);
        ModalUtils.close(this.els.modalDebt);
        this.els.debtDesc.value = ""; this.els.debtAmount.value = "";
        eventBus.publish('SHOW_TOAST', { message: "Tüm aktif dairelere borç yansıtıldı" });
    }

    handlePayDebt(residentId, debtObj) { /* ...Eski kod... */
        eventBus.publish('REQUEST_CONFIRM', {
            title: "Tahsilat Onayı",
            message: `${debtObj.tutar} TL tahsil edilecek. Onaylıyor musunuz?`,
            onConfirm: async () => {
                eventBus.publish('SHOW_LOADING', true);
                const cmd = new PayDebtCommand(residentId, debtObj);
                await commandManager.execute(cmd);
                eventBus.publish('SHOW_LOADING', false);
                ModalUtils.close(this.els.modalEdit);
                eventBus.publish('SHOW_TOAST', { message: "Tahsilat yapıldı" });
            }
        });
    }
}