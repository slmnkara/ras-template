import { commandManager } from "../../core/CommandManager.js";
import { TransactionCommand } from "../../commands/TransactionCommand.js";
import { eventBus } from "../../core/EventManager.js";
import { ModalUtils } from "../../core/ModalUtils.js";

export class AccountingUI {
    constructor() {
        // Elementleri burada seçiyoruz ama DOM'da olmayabilirler
        this.els = {
            modalIncome: document.getElementById('modalIncome'),
            btnOpen: document.getElementById('btnOpenIncomeModal'),
            btnSave: document.getElementById('btnSaveKasaIslem'),
            type: document.getElementById('kasaType'),
            desc: document.getElementById('kasaDesc'),
            amount: document.getElementById('kasaAmount')
        };
        this.initListeners();
    }

    initListeners() {
        // ?. operatörü ile element varsa listener ekle diyoruz
        this.els.btnOpen?.addEventListener('click', () => {
            ModalUtils.open(this.els.modalIncome);
        });

        this.els.btnSave?.addEventListener('click', () => {
            this.handleSave(); // Kod tekrarını önlemek için fonksiyonu ayırdık
        });

        // ENTER TUŞU DESTEĞİ (Güvenli Hale Getirildi)
        this.els.modalIncome?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Eğer focus inputlardaysa kaydet
                this.handleSave();
            }
        });
    }

    handleSave() {
        const type = this.els.type?.value;
        const desc = this.els.desc?.value;
        const amount = this.els.amount?.value;

        if (!desc || !amount) return eventBus.publish('SHOW_TOAST', {message: "Eksik bilgi", type: "error"});

        const cmd = new TransactionCommand({ tur: type, aciklama: desc, tutar: amount });
        commandManager.execute(cmd).then(() => {
            ModalUtils.close(this.els.modalIncome);
            if(this.els.desc) this.els.desc.value = "";
            if(this.els.amount) this.els.amount.value = "";
            eventBus.publish('SHOW_TOAST', {message: "İşlem kaydedildi"});
        });
    }
}