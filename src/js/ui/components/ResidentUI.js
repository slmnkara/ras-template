import { dbService } from "../../services/DbService.js";
import { eventBus } from "../../core/EventManager.js";
import { commandManager } from "../../core/CommandManager.js";
import { DebtCommand } from "../../commands/DebtCommand.js";
import { PayDebtCommand } from "../../commands/PayDebtCommand.js";
import { ModalUtils } from "../../core/ModalUtils.js";

export class ResidentUI {
    constructor() {
        this.els = {
            tableBody: document.getElementById('meskenTableBody'),
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

        this.initListeners();
        this.initSubscribers();
    }

    initSubscribers() {
        eventBus.subscribe('STATE_RESIDENTS_CHANGED', (list) => {
            this.renderTable(list);
        });
    }

    initListeners() {
        // Tablo Tıklamaları
        this.els.tableBody?.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-resident');
            const btnDelete = e.target.closest('.btn-delete-resident');
            const btnLink = e.target.closest('.btn-copy-link');

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
                        eventBus.publish('SHOW_TOAST', {message: "Daire arşivlendi."});
                    }
                });
            }

            if (btnLink) {
                const urlCode = btnLink.dataset.url;
                const fullUrl = `${window.location.origin}${window.location.pathname}?id=${urlCode}`;
                navigator.clipboard.writeText(fullUrl).then(() => {
                    eventBus.publish('SHOW_TOAST', {message: "Link kopyalandı!"});
                });
            }
        });

        // Kaydet Butonları (Güvenli Erişim)
        this.els.btnSaveEdit?.addEventListener('click', () => this.handleUpdateResident());
        this.els.btnSaveDebt?.addEventListener('click', () => this.handleSaveDebt());
        
        this.els.btnOpenAdd?.addEventListener('click', () => ModalUtils.open(this.els.modalAdd));
        this.els.btnSaveNew?.addEventListener('click', () => this.handleAddResident());

        this.els.btnOpenDebt?.addEventListener('click', () => ModalUtils.open(this.els.modalDebt));

        const editDebtList = document.getElementById('editBorcList');
        if(editDebtList) {
            editDebtList.addEventListener('click', (e) => {
                const btnPay = e.target.closest('.btn-pay-single-debt');
                if(btnPay) {
                    const debtData = JSON.parse(decodeURIComponent(btnPay.dataset.debt));
                    const residentId = this.els.editId.value;
                    this.handlePayDebt(residentId, debtData);
                }
            });
        }

        // --- ENTER TUŞU DESTEĞİ (Güvenli) ---
        this.els.modalAdd?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleAddResident();
        });

        this.els.modalEdit?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleUpdateResident();
        });

        this.els.modalDebt?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSaveDebt();
        });
    }

    renderTable(list) {
        if(!this.els.tableBody) return; // Element yoksa çık

        if(list.length === 0) {
            this.els.tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Henüz kayıtlı daire yok.</td></tr>';
            return;
        }

        this.els.tableBody.innerHTML = list.map(m => {
            const jsonStr = encodeURIComponent(JSON.stringify(m));
            const hasDebt = m.borclar && m.borclar.length > 0;
            const statusBadge = hasDebt 
                ? `<span class="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Borçlu</span>`
                : `<span class="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Temiz</span>`;

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
                    <td class="p-4"><div class="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">${m.kod}</div></td>
                    <td class="p-4"><div class="font-medium text-slate-900">${m.sakin_adi}</div><div class="text-xs text-slate-500">Daire ${m.kod}</div></td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button class="btn-copy-link text-slate-400 hover:text-indigo-600 p-2 rounded hover:bg-indigo-50 transition" title="Link Kopyala" data-url="${m.mesken_url}"><i class="fas fa-link"></i></button>
                            <button class="btn-edit-resident text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition" title="Düzenle" data-resident="${jsonStr}"><i class="fas fa-pen"></i></button>
                            <button class="btn-delete-resident text-slate-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="Arşivle" data-id="${m.dbId}"><i class="fas fa-archive"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openEditModal(data) {
        if(!this.els.modalEdit) return;
        
        this.els.editId.value = data.dbId;
        this.els.editName.value = data.sakin_adi;
        this.els.editNo.value = data.kod;
        
        const listContainer = document.getElementById('editBorcList');
        if(listContainer) {
            listContainer.innerHTML = '';
            if (data.borclar && data.borclar.length > 0) {
                data.borclar.forEach(borc => {
                    const jsonDebt = encodeURIComponent(JSON.stringify(borc));
                    listContainer.innerHTML += `
                        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm mb-2">
                            <div><div class="font-medium text-slate-900">${borc.aciklama}</div><div class="text-xs text-slate-500">${borc.tarih}</div></div>
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
        if (!ad || !no) return eventBus.publish('SHOW_TOAST', {message: "Bilgileri girin", type: "error"});

        await dbService.addResident(ad, no);
        ModalUtils.close(this.els.modalAdd);
        this.els.newName.value = ""; this.els.newNo.value = "";
        eventBus.publish('SHOW_TOAST', {message: "Daire eklendi"});
    }

    async handleUpdateResident() {
        const id = this.els.editId.value;
        const ad = this.els.editName.value;
        const no = this.els.editNo.value;
        await dbService.updateResident(id, { sakin_adi: ad, kod: no });
        ModalUtils.close(this.els.modalEdit);
        eventBus.publish('SHOW_TOAST', {message: "Güncellendi"});
    }

    async handleSaveDebt() {
        const desc = this.els.debtDesc.value;
        const amount = this.els.debtAmount.value;
        if (!desc || !amount) return;

        const targetIds = [];
        document.querySelectorAll('.btn-delete-resident').forEach(btn => targetIds.push(btn.dataset.id));

        eventBus.publish('SHOW_LOADING', true);
        const cmd = new DebtCommand(targetIds, { aciklama: desc, tutar: amount });
        await commandManager.execute(cmd);
        
        eventBus.publish('SHOW_LOADING', false);
        ModalUtils.close(this.els.modalDebt);
        this.els.debtDesc.value = ""; this.els.debtAmount.value = "";
        eventBus.publish('SHOW_TOAST', {message: "Borç yansıtıldı"});
    }

    handlePayDebt(residentId, debtObj) {
        eventBus.publish('REQUEST_CONFIRM', {
            title: "Tahsilat Onayı",
            message: `${debtObj.tutar} TL tahsil edilecek. Onaylıyor musunuz?`,
            onConfirm: async () => {
                eventBus.publish('SHOW_LOADING', true);
                const cmd = new PayDebtCommand(residentId, debtObj);
                await commandManager.execute(cmd);
                eventBus.publish('SHOW_LOADING', false);
                ModalUtils.close(this.els.modalEdit);
                eventBus.publish('SHOW_TOAST', {message: "Tahsilat yapıldı"});
            }
        });
    }
}