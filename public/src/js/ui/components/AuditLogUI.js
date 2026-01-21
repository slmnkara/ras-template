import { dbService } from "../../services/DbService.js";
import { commandManager } from "../../core/CommandManager.js";
import { ModalUtils } from "../../core/ModalUtils.js";
import { eventBus } from "../../core/EventManager.js";
import { createEl } from "../../core/DomUtils.js";

export class AuditLogUI {
    constructor() {
        this.els = {
            modal: document.getElementById('modalAuditLog'),
            btnOpenSidebar: document.getElementById('navAuditLog'),
            btnOpenGlobal: document.getElementById('globalUndoBtn'), // Üstteki "Geri Al" butonu
            listContainer: document.getElementById('auditLogList')
        };

        this.initListeners();
    }

    initListeners() {
        // Sidebar butonuna tıklandığında
        this.els.btnOpenSidebar?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });

        // Üstteki Global "Geri Al" butonunu artık bu modalı açmaya yönlendiriyoruz
        this.els.btnOpenGlobal?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });

        // Liste içindeki "Geri Al" butonlarına tıklama (Event Delegation)
        this.els.listContainer?.addEventListener('click', (e) => {
            const btnUndo = e.target.closest('.btn-undo-log');
            if (btnUndo) {
                const logData = JSON.parse(decodeURIComponent(btnUndo.dataset.log));
                this.handleUndoRequest(logData);
            }
        });
    }

    async openModal() {
        ModalUtils.open(this.els.modal);
        this.renderLoading();
        
        try {
            const logs = await dbService.getRecentAuditLogs();
            this.renderList(logs);
        } catch (error) {
            console.error(error);
            this.els.listContainer.innerHTML = '<div class="text-red-500 text-center py-4">Kayıtlar yüklenirken hata oluştu.</div>';
        }
    }

    renderLoading() {
        this.els.listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 gap-3">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <div class="text-slate-400 text-sm">İşlemler yükleniyor...</div>
            </div>`;
    }

    renderList(logs) {
        this.els.listContainer.innerHTML = '';

        if (logs.length === 0) {
            // Güvenli HTML string (Değişken içermiyor)
            this.els.listContainer.innerHTML = `
                <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <i class="fas fa-history text-3xl text-slate-300 mb-3"></i>
                    <p class="text-slate-500">Son 24 saatte kaydedilmiş işlem yok.</p>
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        logs.forEach(log => {
            let details = {};
            try { details = JSON.parse(log.details); } catch(e){}

            // Stil belirleme (Mevcut mantık)
            let title = "Bilinmeyen İşlem";
            let icon = "fa-cog";
            let color = "bg-gray-100 text-gray-600";

            if (log.command_name === 'TransactionCommand') {
                title = details.tur === 'gelir' ? 'Gelir Girişi' : 'Gider Kaydı';
                icon = details.tur === 'gelir' ? 'fa-arrow-down' : 'fa-arrow-up';
                color = details.tur === 'gelir' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';
            } else if (log.command_name === 'DebtCommand') {
                title = 'Toplu Borçlandırma';
                icon = 'fa-users';
                color = 'bg-orange-100 text-orange-600';
            } else if (log.command_name === 'PayDebtCommand') {
                title = 'Tahsilat';
                icon = 'fa-check-circle';
                color = 'bg-indigo-100 text-indigo-600';
            }

            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000) : new Date();
            const timeStr = date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});

            // DOM Oluşturma
            const row = createEl('div', 'flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 transition-colors shadow-sm');
            
            // Sol Taraf
            const leftDiv = createEl('div', 'flex items-center gap-3');
            const iconDiv = createEl('div', `w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`);
            iconDiv.appendChild(createEl('i', `fas ${icon}`));

            const textDiv = createEl('div');
            textDiv.appendChild(createEl('h5', 'text-sm font-bold text-slate-800', title));
            // GÜVENLİK: createEl textContent kullanır, XSS'i engeller.
            textDiv.appendChild(createEl('p', 'text-xs text-slate-500 truncate max-w-[200px]', details.aciklama || '-'));
            textDiv.appendChild(createEl('span', 'text-[10px] text-slate-400', timeStr));

            leftDiv.appendChild(iconDiv);
            leftDiv.appendChild(textDiv);

            // Sağ Taraf (Buton)
            const rightDiv = createEl('div');
            
            if (log.action_type === 'UNDO') {
                rightDiv.appendChild(createEl('span', 'text-xs text-slate-400 italic', 'Geri Alma Kaydı'));
            } else if (log.is_undone === true) {
                rightDiv.appendChild(createEl('span', 'text-xs font-bold text-red-400 bg-red-50 px-2 py-1 rounded', 'İptal Edildi'));
            } else {
                const btnUndo = createEl('button', 'btn-undo-log text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1 group/btn', ' Geri Al');
                btnUndo.prepend(createEl('i', 'fas fa-undo text-slate-400 group-hover/btn:text-indigo-600'));
                btnUndo.dataset.log = encodeURIComponent(JSON.stringify(log));
                rightDiv.appendChild(btnUndo);
            }

            row.appendChild(leftDiv);
            row.appendChild(rightDiv);
            fragment.appendChild(row);
        });

        this.els.listContainer.appendChild(fragment);
    }

    handleUndoRequest(logData) {
        eventBus.publish('REQUEST_CONFIRM', {
            title: "İşlemi Geri Al",
            message: "Bu işlem geri alınacak ve yapılan değişiklikler tersine çevrilecek. Emin misiniz?",
            onConfirm: async () => {
                eventBus.publish('SHOW_LOADING', true);
                await commandManager.undoFromLog(logData);
                // Listeyi yenile
                await this.openModal(); // Yeniden yükler
                eventBus.publish('SHOW_LOADING', false);
            }
        });
    }
}