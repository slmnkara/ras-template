import { dbService } from "../../services/DbService.js";
import { eventBus } from "../../core/EventManager.js";
import { commandManager } from "../../core/CommandManager.js";
import { DebtCommand } from "../../commands/DebtCommand.js";
import { TransactionCommand } from "../../commands/TransactionCommand.js";
import { store } from "../../core/Store.js";
import { createEl } from "../../core/DomUtils.js";

export class TemplateUI {
    constructor() {
        this.els = {
            view: document.getElementById('templatesView'),
            list: document.getElementById('templateList'),
            btnSave: document.getElementById('btnSaveTemplate'),
            type: document.getElementById('tplType'),
            desc: document.getElementById('tplDesc'),
            amount: document.getElementById('tplAmount')
        };

        this.initListeners();
        this.initSubscribers();
    }

    initSubscribers() {
        eventBus.subscribe('STATE_TEMPLATES_CHANGED', (list) => {
            this.renderList(list);
        });
    }

    initListeners() {
        this.els.btnSave?.addEventListener('click', () => this.handleSave());
        
        // Liste üzerindeki buton tıklamaları (Delegation)
        this.els.list?.addEventListener('click', (e) => {
            const btnDelete = e.target.closest('.btn-delete-tpl');
            const btnApply = e.target.closest('.btn-apply-tpl');

            if (btnDelete) {
                const id = btnDelete.dataset.id;
                this.handleDelete(id);
            }

            if (btnApply) {
                const data = JSON.parse(decodeURIComponent(btnApply.dataset.tpl));
                this.handleApply(data);
            }
        });
    }

    async handleSave() {
        const type = this.els.type.value;
        const desc = this.els.desc.value;
        const amount = this.els.amount.value;

        if (!desc || !amount) {
            return eventBus.publish('SHOW_TOAST', { message: "Lütfen tüm alanları doldurun.", type: 'error' });
        }

        eventBus.publish('SHOW_LOADING', true);
        try {
            await dbService.addTemplate({ tur: type, aciklama: desc, tutar: amount });
            eventBus.publish('SHOW_TOAST', { message: "Şablon kaydedildi." });
            // Formu temizle
            this.els.desc.value = "";
            this.els.amount.value = "";
        } catch (error) {
            console.error(error);
            eventBus.publish('SHOW_TOAST', { message: "Hata oluştu.", type: 'error' });
        } finally {
            eventBus.publish('SHOW_LOADING', false);
        }
    }

    async handleDelete(id) {
        eventBus.publish('REQUEST_CONFIRM', {
            title: "Şablonu Sil",
            message: "Bu şablon silinecek. Emin misiniz?",
            onConfirm: async () => {
                await dbService.deleteTemplate(id);
                eventBus.publish('SHOW_TOAST', { message: "Şablon silindi." });
            }
        });
    }

    handleApply(tpl) {
        const actionName = tpl.tur === 'aidat' ? 'Toplu Borçlandırma' : 'Gider Kaydı';
        const message = `"${tpl.aciklama}" başlıklı ${tpl.tutar} TL tutarındaki işlem gerçekleştirilecek.\nBu işlem ${actionName} olarak işlenecektir.`;

        eventBus.publish('REQUEST_CONFIRM', {
            title: `${actionName} Onayı`,
            message: message,
            onConfirm: async () => {
                eventBus.publish('SHOW_LOADING', true);
                try {
                    if (tpl.tur === 'aidat') {
                        // 1. Tüm sakinleri al
                        const residents = store.residents; 
                        if (!residents || residents.length === 0) throw new Error("Kayıtlı sakin bulunamadı.");
                        
                        // SADECE AKTİF OLANLARI FİLTRELE
                        const activeResidents = residents.filter(r => r.aktif_mi !== false);
                        
                        if (activeResidents.length === 0) throw new Error("Borçlandırılacak aktif sakin bulunamadı.");

                        const targetIds = activeResidents.map(r => r.dbId);
                        
                        // 2. DebtCommand Kullan
                        const cmd = new DebtCommand(targetIds, { aciklama: tpl.aciklama, tutar: tpl.tutar });
                        await commandManager.execute(cmd);
                        
                    } else if (tpl.tur === 'gider') {
                        // TransactionCommand Kullan (Gider olarak)
                        const cmd = new TransactionCommand({ tur: 'gider', aciklama: tpl.aciklama, tutar: tpl.tutar });
                        await commandManager.execute(cmd);
                    }
                    
                    eventBus.publish('SHOW_TOAST', { message: "İşlem başarıyla uygulandı." });
                } catch (error) {
                    console.error(error);
                    eventBus.publish('SHOW_TOAST', { message: "İşlem başarısız: " + error.message, type: 'error' });
                } finally {
                    eventBus.publish('SHOW_LOADING', false);
                }
            }
        });
    }

    renderList(list) {
        this.els.list.innerHTML = ''; // Temizle

        if (list.length === 0) {
            this.els.list.appendChild(createEl('div', 'text-center text-slate-400 py-10 col-span-2 bg-slate-50 rounded-xl border border-dashed border-slate-200', 'Henüz şablon eklenmemiş.'));
            return;
        }

        const fragment = document.createDocumentFragment();

        list.forEach(t => {
            const isAidat = t.tur === 'aidat';
            const color = isAidat ? 'text-indigo-600 bg-indigo-50' : 'text-orange-600 bg-orange-50';
            const icon = isAidat ? 'fa-users' : 'fa-wallet';
            const badgeText = isAidat ? 'Aidat (Borç)' : 'Gider (Kasa)';

            // Ana Kart
            const card = createEl('div', 'bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between hover:border-indigo-200 transition-colors group');

            // Üst Kısım
            const topDiv = createEl('div', 'flex justify-between items-start mb-4');
            const leftDiv = createEl('div', 'flex items-center gap-3');
            
            const iconBox = createEl('div', `w-10 h-10 rounded-lg ${color} flex items-center justify-center`);
            iconBox.appendChild(createEl('i', `fas ${icon}`));

            const textBox = createEl('div');
            // GÜVENLİK: textContent kullanımı
            textBox.appendChild(createEl('h4', 'font-bold text-slate-800', t.aciklama)); 
            textBox.appendChild(createEl('span', 'text-xs font-medium uppercase tracking-wider text-slate-400', badgeText));

            leftDiv.appendChild(iconBox);
            leftDiv.appendChild(textBox);

            const btnDelete = createEl('button', 'btn-delete-tpl text-slate-300 hover:text-red-500 transition-colors');
            btnDelete.dataset.id = t.id;
            btnDelete.appendChild(createEl('i', 'fas fa-trash'));

            topDiv.appendChild(leftDiv);
            topDiv.appendChild(btnDelete);

            // Alt Kısım
            const bottomDiv = createEl('div', 'flex items-center justify-between mt-2 pt-4 border-t border-slate-50');
            bottomDiv.appendChild(createEl('span', 'font-bold text-lg text-slate-700 font-mono', `${t.tutar} ₺`));

            const btnApply = createEl('button', 'btn-apply-tpl bg-slate-900 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200 active:scale-95 flex items-center gap-2', ' Uygula');
            const playIcon = createEl('i', 'fas fa-play text-xs');
            btnApply.prepend(playIcon); // İkonu başa ekle
            btnApply.dataset.tpl = encodeURIComponent(JSON.stringify(t));

            bottomDiv.appendChild(btnApply);

            card.appendChild(topDiv);
            card.appendChild(bottomDiv);
            fragment.appendChild(card);
        });

        this.els.list.appendChild(fragment);
    }

    show() {
        this.els.view.classList.remove('hidden-view');
    }

    hide() {
        this.els.view.classList.add('hidden-view');
    }
}