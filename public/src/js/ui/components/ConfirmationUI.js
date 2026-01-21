import { eventBus } from "../../core/EventManager.js";
import { ModalUtils } from "../../core/ModalUtils.js"; // <--- YENİ

export class ConfirmationUI {
    constructor() {
        this.els = {
            modalConfirm: document.getElementById('modalConfirm'),
            title: document.getElementById('confirmTitle'),
            message: document.getElementById('confirmMessage'),
            btnApprove: document.getElementById('btnApproveConfirm'),
            toastContainer: document.getElementById('toastContainer')
        };
        this.initSubscribers();
        this.initListeners();
    }

    initSubscribers() {
        // Başka yerlerden gelen onay isteklerini dinle
        eventBus.subscribe('REQUEST_CONFIRM', (payload) => {
            this.showConfirm(payload.title, payload.message, payload.onConfirm);
        });

        // Toast isteklerini dinle
        eventBus.subscribe('SHOW_TOAST', (payload) => {
            this.showToast(payload.message, payload.type);
        });
    }

    initListeners() {
        // Vazgeç butonu (HTML'de class ile tanımlı)
        const cancelBtn = this.els.modalConfirm?.querySelector('.btn-close-confirm');
        if(cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                ModalUtils.close(this.els.modalConfirm); // <--- DEĞİŞTİ
            });
        }
    }

    showConfirm(title, message, onConfirmCallback) {
        this.els.title.innerText = title;
        this.els.message.innerText = message;
        ModalUtils.open(this.els.modalConfirm); // <--- DEĞİŞTİ

        // Önceki listenerları temizlemek için klonlayıp değiştiriyoruz veya onlick atıyoruz
        this.els.btnApprove.onclick = () => {
            onConfirmCallback();
            ModalUtils.close(this.els.modalConfirm); // <--- DEĞİŞTİ
        };
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const colors = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-yellow-600');
        const icon = type === 'success' ? 'fa-check' : 'fa-exclamation-circle';
        
        toast.className = `${colors} text-white px-4 py-3 rounded shadow-lg transition-all duration-500 transform translate-y-10 opacity-0 flex items-center gap-2 mb-2`;
        toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        
        this.els.toastContainer.appendChild(toast);

        // Animasyon
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}