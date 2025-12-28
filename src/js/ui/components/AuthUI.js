import { authService } from "../../services/AuthService.js";
import { eventBus } from "../../core/EventManager.js";
import { store } from "../../core/Store.js";
import { ModalUtils } from "../../core/ModalUtils.js"; // <--- YENİ

export class AuthUI {
    constructor() {
        this.els = {
            loginView: document.getElementById('loginView'),
            adminView: document.getElementById('adminView'),
            // YENİ TABS ELEMENTLERİ
            tabLogin: document.getElementById('tabLogin'),
            tabRegister: document.getElementById('tabRegister'),
            loginForm: document.getElementById('loginForm'),
            registerForm: document.getElementById('registerForm'),
            linkToRegister: document.getElementById('linkToRegister'),
            linkToLogin: document.getElementById('linkToLogin'),
            textRegisterInfo: document.getElementById('showRegisterText'),
            textLoginInfo: document.getElementById('showLoginText'),
            regEmail: document.getElementById('regEmail'),
            regPassword: document.getElementById('regPassword'),
            modalProfile: document.getElementById('modalProfile'),
            userProfileBtn: document.getElementById('adminEmailLabel')?.parentElement,
            btnLogout: document.getElementById('btnLogout')
        };

        this.initListeners();
        this.initSubscribers();
    }

    initListeners() {
        // Form Geçişleri
        this.els.tabLogin?.addEventListener('click', () => this.switchTab('login'));
        this.els.tabRegister?.addEventListener('click', () => this.switchTab('register'));

        // Login
        this.els.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            eventBus.publish('SHOW_LOADING', true);
            authService.login(email, password);
        });

        // Register
        this.els.registerForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = this.els.regEmail.value;
            const pass = this.els.regPassword.value;
            if(!email || !pass) return eventBus.publish('SHOW_TOAST', {message: "Eksik bilgi", type: "error"});
            
            eventBus.publish('SHOW_LOADING', true);
            authService.register(email, pass);
        });

        // Profil Açma (ANİMASYONLU)
        this.els.userProfileBtn?.addEventListener('click', () => {
            this.updateProfileModal();
            ModalUtils.open(this.els.modalProfile); // <--- DEĞİŞTİ
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

    toggleForms(target) {
        if(target === 'register') {
            this.els.loginForm.classList.add('hidden-view');
            this.els.registerForm.classList.remove('hidden-view');
            this.els.textRegisterInfo.classList.add('hidden-view');
            this.els.textLoginInfo.classList.remove('hidden-view');
        } else {
            this.els.registerForm.classList.add('hidden-view');
            this.els.loginForm.classList.remove('hidden-view');
            this.els.textLoginInfo.classList.add('hidden-view');
            this.els.textRegisterInfo.classList.remove('hidden-view');
        }
    }

    updateProfileModal() {
        const sub = store.subscription;
        if(!sub) return;

        const endDate = new Date(sub.abonelik_bitis);
        const today = new Date();
        const diffTime = Math.abs(endDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        document.getElementById('profileEmail').innerText = sub.email;
        document.getElementById('profileEndDate').innerText = endDate.toLocaleDateString('tr-TR');
        document.getElementById('profileDaysLeft').innerText = `Kalan Süre: ${diffDays} Gün`;
    }

    // TAB DEĞİŞTİRME FONKSİYONU
    switchTab(mode) {
        const activeClass = "bg-white text-slate-800 shadow-sm";
        const inactiveClass = "text-slate-500 hover:text-slate-700";

        if (mode === 'login') {
            // Buton Stilleri
            this.els.tabLogin.className = `py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 w-full ${activeClass}`;
            this.els.tabRegister.className = `py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 w-full ${inactiveClass}`;
            
            // Form Göster/Gizle
            this.els.loginForm.classList.remove('hidden-view');
            this.els.registerForm.classList.add('hidden-view');
        } else {
            // Buton Stilleri
            this.els.tabRegister.className = `py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 w-full ${activeClass}`;
            this.els.tabLogin.className = `py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 w-full ${inactiveClass}`;
            
            // Form Göster/Gizle
            this.els.registerForm.classList.remove('hidden-view');
            this.els.loginForm.classList.add('hidden-view');
        }
    }
}