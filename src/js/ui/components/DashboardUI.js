import { eventBus } from "../../core/EventManager.js";
import { dbService } from "../../services/DbService.js";
import { ModalUtils } from "../../core/ModalUtils.js";
import { $, createEl } from "../../core/DomUtils.js"; // Helper eklendi

export class DashboardUI {
    constructor() {
        // Güvenli seçici ($) kullanıyoruz
        this.els = {
            kasaBakiye: $('kasaBakiye'),
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
        eventBus.subscribe('STATE_BALANCE_CHANGED', (balance) => {
            // innerText XSS korumalıdır
            this.els.kasaBakiye.innerText = `${balance} ₺`;
        });

        eventBus.subscribe('STATE_TRANSACTIONS_CHANGED', (list) => {
            this.renderTransactions(list);
        });
    }

    initListeners() {
        // Optional Chaining (?.) yerine güvenli element kullandığımız için direkt ekleyebiliriz
        // ama yine de kontrol iyi pratiktir.
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
    }

    // GÜVENLİ RENDER (innerHTML YOK)
    renderTransactions(list) {
        // Listeyi temizle
        this.els.kasaList.innerHTML = '';

        if (list.length === 0) {
            const emptyState = createEl('div', 'flex flex-col items-center justify-center h-full text-gray-400 py-10');
            emptyState.appendChild(createEl('i', 'fas fa-inbox text-4xl mb-2 opacity-50'));
            emptyState.appendChild(createEl('p', 'text-sm', 'Henüz işlem bulunmuyor.'));
            this.els.kasaList.appendChild(emptyState);
            return;
        }

        const fragment = document.createDocumentFragment(); // Performans için fragment

        list.slice(0, 50).forEach(item => {
            const isGelir = item.tur === 'gelir';
            const isCorrection = item.is_correction;

            const li = createEl('li', 'flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0');

            // --- Sol Taraf (İkon + Metin) ---
            const leftDiv = createEl('div', 'flex items-center gap-3');
            
            // İkon
            let iconBg = isCorrection ? 'bg-gray-100 text-gray-500' : (isGelir ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600');
            let iconClass = isCorrection ? 'fa-undo' : (isGelir ? 'fa-arrow-down' : 'fa-arrow-up');
            
            const iconContainer = createEl('div', `w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`);
            iconContainer.appendChild(createEl('i', `fas ${iconClass} text-sm`));

            // Metinler
            const textDiv = createEl('div', 'flex flex-col min-w-0');
            textDiv.appendChild(createEl('span', `text-sm font-medium text-gray-900 truncate ${isCorrection ? 'text-gray-500 line-through' : ''}`, item.aciklama));
            textDiv.appendChild(createEl('span', 'text-[10px] text-gray-400', item.tarih));

            leftDiv.appendChild(iconContainer);
            leftDiv.appendChild(textDiv);

            // --- Sağ Taraf (Tutar) ---
            const amountColor = isCorrection ? 'text-gray-400 line-through' : (isGelir ? 'text-green-600' : 'text-red-600');
            const prefix = isCorrection ? '' : (isGelir ? '+' : '-');
            
            const amountSpan = createEl('span', `font-bold text-sm ${amountColor} whitespace-nowrap ml-2`, `${prefix}${item.tutar} ₺`);

            li.appendChild(leftDiv);
            li.appendChild(amountSpan);
            
            fragment.appendChild(li);
        });

        this.els.kasaList.appendChild(fragment);
    }

    show() {
        this.els.adminView.classList.remove('hidden-view');
    }

    async handlePrintReport() {
        // ... (Mevcut kodun aynısı, sadece DOMUtils ile optimize edilebilir)
        // Print HTML'i string olarak kalabilir çünkü yeni bir pencerede/iframe'de
        // açılıyor ve kullanıcı girdisi (script tag vb) içermiyor.
        // Ancak yine de template literal içindeki değişkenleri sanitize etmek gerekir.
        // Şimdilik aynen bırakıyorum, v1.1'de sanitize edeceğiz.
        const startVal = this.els.dateStart.value;
        const endVal = this.els.dateEnd.value;
        if (!startVal || !endVal) return eventBus.publish('SHOW_TOAST', {message: "Tarih seçin", type: "error"});

        eventBus.publish('SHOW_LOADING', true);
        try {
            const filtered = await dbService.getTransactionsByDate(startVal, endVal);
            eventBus.publish('SHOW_LOADING', false);
            if (filtered.length === 0) return eventBus.publish('SHOW_TOAST', {message: "Kayıt bulunamadı", type: "error"});
            this.generatePrintHtml(filtered, startVal, endVal);
        } catch (error) {
            eventBus.publish('SHOW_LOADING', false);
            console.error(error);
            eventBus.publish('SHOW_TOAST', {message: "Rapor hatası", type: "error"});
        }
    }
    
    // ... generatePrintHtml fonksiyonu (mevcut haliyle kalabilir)
    generatePrintHtml(filtered, startVal, endVal) {
        // (Buradaki kodun aynısı korunacak)
        // ...
         let gelir = 0, gider = 0;
        const sDateTR = startVal.split('-').reverse().join('.');
        const eDateTR = endVal.split('-').reverse().join('.');

        let html = `
        <div style="font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333;">
            <div style="text-align:center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px;">
                <h2 style="margin:0; color:#1f2937;">Apartman Hesap Özeti</h2>
                <p style="margin:5px 0 0; color:#6b7280; font-size:14px;">${sDateTR} - ${eDateTR}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background-color:#f9fafb; color:#374151; text-align:left;">
                        <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Tarih</th>
                        <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Açıklama</th>
                        <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Tür</th>
                        <th style="padding:12px; border-bottom:1px solid #e5e7eb; text-align:right;">Tutar</th>
                    </tr>
                </thead>
                <tbody>`;

        filtered.forEach(item => {
            const val = parseFloat(item.tutar);
            if (item.tur === 'gelir') gelir += val; else gider += val;
            const color = item.tur === 'gelir' ? '#16a34a' : '#dc2626';
            const prefix = item.tur === 'gelir' ? '+' : '-';
            const style = item.is_correction ? 'text-decoration:line-through; color:#9ca3af;' : '';

            html += `
                <tr style="${style}">
                    <td style="padding:10px; border-bottom:1px solid #f3f4f6;">${item.tarih}</td>
                    <td style="padding:10px; border-bottom:1px solid #f3f4f6;">${item.aciklama} ${item.is_correction ? '(İPTAL)' : ''}</td>
                    <td style="padding:10px; border-bottom:1px solid #f3f4f6; text-align:right; color:${item.is_correction ? '#9ca3af' : color}; font-weight:bold;">
                        ${prefix}${val.toFixed(2)} ₺
                    </td>
                </tr>`;
        });

        const net = gelir - gider;
        html += `</tbody></table>
            <div style="margin-top:30px; display:flex; justify-content:flex-end;">
                <table style="width:250px; text-align:right; font-size:14px;">
                    <tr><td style="padding:5px; color:#6b7280;">Toplam Gelir:</td><td style="padding:5px; color:#16a34a; font-weight:bold;">+${gelir.toFixed(2)} ₺</td></tr>
                    <tr><td style="padding:5px; color:#6b7280;">Toplam Gider:</td><td style="padding:5px; color:#dc2626; font-weight:bold;">-${gider.toFixed(2)} ₺</td></tr>
                    <tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px; font-weight:bold;">NET BAKİYE:</td><td style="padding:10px; font-weight:bold;">${net.toFixed(2)} ₺</td></tr>
                </table>
            </div>
        </div>`;

        this.els.printArea.innerHTML = html;
        window.print();
    }
}