import { authService } from "../../services/AuthService.js";
import { eventBus } from "../../core/EventManager.js";
import { store } from "../../core/Store.js";
import { ModalUtils } from "../../core/ModalUtils.js";

export class AuthUI {
    constructor() {
        this.els = {
            loginView: document.getElementById('loginView'),
            adminView: document.getElementById('adminView'),
            loginForm: document.getElementById('loginForm'),
            modalProfile: document.getElementById('modalProfile'),
            userProfileBtn: document.getElementById('adminEmailLabel')?.parentElement,
            btnLogout: document.getElementById('btnLogout')
        };

        this.initListeners();
        this.initSubscribers();
    }

    initListeners() {
        // Login Submit
        this.els.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            eventBus.publish('SHOW_LOADING', true);
            authService.login(email, password);
        });

        // Profil Açma
        this.els.userProfileBtn?.addEventListener('click', () => {
            this.updateProfileModal();
            ModalUtils.open(this.els.modalProfile);
        });
        
        // Çıkış (Logout)
        this.els.btnLogout?.addEventListener('click', () => {
             eventBus.publish('REQUEST_CONFIRM', {
                title: "Çıkış Yap",
                message: "Oturumunuz sonlandırılacak. Emin misiniz?",
                onConfirm: () => authService.logout()
             });
        });
    }

    initSubscribers() {
        eventBus.subscribe('AUTH_STATE_CHANGED', (state) => {
            eventBus.publish('SHOW_LOADING', false);
            if (state.isLoggedIn) {
                this.els.loginView.classList.add('hidden-view');
                if(document.getElementById('adminEmailLabel'))
                    document.getElementById('adminEmailLabel').innerText = state.user.email;
            } else {
                this.els.loginView.classList.remove('hidden-view');
                this.els.adminView.classList.add('hidden-view');
            }
        });
    }

    updateProfileModal() {
        const sub = store.subscription;
        if(!sub) return;

        const endDate = new Date(sub.abonelik_bitis);
        const today = new Date();
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        document.getElementById('profileEmail').innerText = sub.email;
        document.getElementById('profileEndDate').innerText = endDate.toLocaleDateString('tr-TR');
        
        const daysLabel = document.getElementById('profileDaysLeft');
        if (diffDays > 0) {
            daysLabel.innerText = `Kalan Süre: ${diffDays} Gün`;
            daysLabel.className = "font-bold text-green-600";
        } else {
            daysLabel.innerText = `Süre Doldu (${Math.abs(diffDays)} Gün geçti)`;
            daysLabel.className = "font-bold text-red-600";
        }
    }
}