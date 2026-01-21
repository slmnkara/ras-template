import { authService } from "../../services/AuthService.js";
import { eventBus } from "../../core/EventManager.js";
import { store } from "../../core/Store.js";
import { ModalUtils } from "../../core/ModalUtils.js";

export class AuthUI {
    constructor() {
        this.isRegisterMode = false;

        this.els = {
            loginView: document.getElementById('loginView'),
            adminView: document.getElementById('adminView'),
            loginForm: document.getElementById('loginForm'),
            registerForm: document.getElementById('registerForm'),
            loginFormWrapper: document.getElementById('loginFormWrapper'),
            registerFormWrapper: document.getElementById('registerFormWrapper'),
            authModeToggle: document.getElementById('authModeToggle'),
            toggleDot: document.getElementById('toggleDot'),
            loginLabel: document.getElementById('loginLabel'),
            registerLabel: document.getElementById('registerLabel'),
            googleSignInBtn: document.getElementById('googleSignInBtn'),
            googleBtnText: document.getElementById('googleBtnText'),
            registerPassword: document.getElementById('registerPassword'),
            registerPasswordConfirm: document.getElementById('registerPasswordConfirm'),
            registerSubmitBtn: document.getElementById('registerSubmitBtn'),
            passwordMatchError: document.getElementById('passwordMatchError'),
            modalProfile: document.getElementById('modalProfile'),
            userProfileBtn: document.getElementById('adminEmailLabel')?.parentElement,
            btnLogout: document.getElementById('btnLogout'),
            // Password requirement elements
            reqLength: document.getElementById('reqLength'),
            reqUppercase: document.getElementById('reqUppercase'),
            reqLowercase: document.getElementById('reqLowercase'),
            reqNumber: document.getElementById('reqNumber'),
            reqSpecial: document.getElementById('reqSpecial')
        };

        this.passwordRequirements = {
            length: false,
            uppercase: false,
            lowercase: false,
            number: false,
            special: false
        };

        this.initListeners();
        this.initSubscribers();
        this.initOnboardingListeners();
    }

    initListeners() {
        // Login Submit
        this.els.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            eventBus.publish('SHOW_LOADING', true);
            authService.login(email, password);
        });

        // Register Submit
        this.els.registerForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

            // Validate passwords match
            if (password !== passwordConfirm) {
                eventBus.publish('SHOW_TOAST', { message: "Şifreler eşleşmiyor.", type: "error" });
                return;
            }

            // Validate password requirements
            if (!this.allRequirementsMet()) {
                eventBus.publish('SHOW_TOAST', { message: "Şifre gereksinimleri karşılanmıyor.", type: "error" });
                return;
            }

            eventBus.publish('SHOW_LOADING', true);
            authService.register(email, password);
        });

        // Toggle Switch Handler
        this.els.authModeToggle?.addEventListener('click', () => {
            this.toggleAuthMode();
        });

        // Google Sign In
        this.els.googleSignInBtn?.addEventListener('click', async () => {
            eventBus.publish('SHOW_LOADING', true);
            try {
                await authService.signInWithGoogle();
            } catch (error) {
                // Error is already handled in AuthService
            }
        });

        // Password Validation on Input
        this.els.registerPassword?.addEventListener('input', (e) => {
            this.validatePassword(e.target.value);
            this.checkPasswordMatch();
        });

        // Password Confirm Validation
        this.els.registerPasswordConfirm?.addEventListener('input', () => {
            this.checkPasswordMatch();
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

    toggleAuthMode() {
        this.isRegisterMode = !this.isRegisterMode;

        if (this.isRegisterMode) {
            // Switch to Register
            this.els.loginFormWrapper?.classList.add('hidden');
            this.els.registerFormWrapper?.classList.remove('hidden');
            this.els.toggleDot?.classList.remove('translate-x-1');
            this.els.toggleDot?.classList.add('translate-x-8');
            this.els.authModeToggle?.classList.remove('bg-slate-200');
            this.els.authModeToggle?.classList.add('bg-indigo-600');
            this.els.loginLabel?.classList.remove('text-indigo-600');
            this.els.loginLabel?.classList.add('text-slate-400');
            this.els.registerLabel?.classList.remove('text-slate-400');
            this.els.registerLabel?.classList.add('text-indigo-600');
            this.els.googleBtnText.textContent = 'Google ile Kayıt Ol';
        } else {
            // Switch to Login
            this.els.loginFormWrapper?.classList.remove('hidden');
            this.els.registerFormWrapper?.classList.add('hidden');
            this.els.toggleDot?.classList.remove('translate-x-8');
            this.els.toggleDot?.classList.add('translate-x-1');
            this.els.authModeToggle?.classList.remove('bg-indigo-600');
            this.els.authModeToggle?.classList.add('bg-slate-200');
            this.els.loginLabel?.classList.remove('text-slate-400');
            this.els.loginLabel?.classList.add('text-indigo-600');
            this.els.registerLabel?.classList.remove('text-indigo-600');
            this.els.registerLabel?.classList.add('text-slate-400');
            this.els.googleBtnText.textContent = 'Google ile Giriş Yap';
        }
    }

    validatePassword(password) {
        // Check each requirement
        this.passwordRequirements.length = password.length >= 8;
        this.passwordRequirements.uppercase = /[A-Z]/.test(password);
        this.passwordRequirements.lowercase = /[a-z]/.test(password);
        this.passwordRequirements.number = /[0-9]/.test(password);
        this.passwordRequirements.special = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        // Update UI
        this.updateRequirementUI(this.els.reqLength, this.passwordRequirements.length);
        this.updateRequirementUI(this.els.reqUppercase, this.passwordRequirements.uppercase);
        this.updateRequirementUI(this.els.reqLowercase, this.passwordRequirements.lowercase);
        this.updateRequirementUI(this.els.reqNumber, this.passwordRequirements.number);
        this.updateRequirementUI(this.els.reqSpecial, this.passwordRequirements.special);

        // Update submit button state
        this.updateSubmitButtonState();
    }

    updateRequirementUI(element, isMet) {
        if (!element) return;

        const icon = element.querySelector('i');
        if (isMet) {
            element.classList.remove('text-slate-400', 'text-red-500');
            element.classList.add('text-green-500');
            if (icon) {
                icon.classList.remove('fa-circle', 'fa-times-circle');
                icon.classList.add('fa-check-circle');
            }
        } else {
            element.classList.remove('text-green-500');
            element.classList.add('text-slate-400');
            if (icon) {
                icon.classList.remove('fa-check-circle', 'fa-times-circle');
                icon.classList.add('fa-circle');
            }
        }
    }

    checkPasswordMatch() {
        const password = this.els.registerPassword?.value || '';
        const confirmPassword = this.els.registerPasswordConfirm?.value || '';

        if (confirmPassword.length === 0) {
            this.els.passwordMatchError?.classList.add('hidden');
        } else if (password !== confirmPassword) {
            this.els.passwordMatchError?.classList.remove('hidden');
        } else {
            this.els.passwordMatchError?.classList.add('hidden');
        }

        this.updateSubmitButtonState();
    }

    allRequirementsMet() {
        return Object.values(this.passwordRequirements).every(r => r === true);
    }

    passwordsMatch() {
        const password = this.els.registerPassword?.value || '';
        const confirmPassword = this.els.registerPasswordConfirm?.value || '';
        return password === confirmPassword && password.length > 0;
    }

    updateSubmitButtonState() {
        const canSubmit = this.allRequirementsMet() && this.passwordsMatch();
        if (this.els.registerSubmitBtn) {
            this.els.registerSubmitBtn.disabled = !canSubmit;
        }
    }

    initSubscribers() {
        eventBus.subscribe('AUTH_STATE_CHANGED', (state) => {
            eventBus.publish('SHOW_LOADING', false);
            if (state.isLoggedIn) {
                this.els.loginView.classList.add('hidden-view');
                if (document.getElementById('adminEmailLabel'))
                    document.getElementById('adminEmailLabel').innerText = state.user.email;
            } else {
                this.els.loginView.classList.remove('hidden-view');
                this.els.adminView.classList.add('hidden-view');
            }
        });
    }

    updateProfileModal() {
        const sub = store.subscription;
        if (!sub) return;

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

    // --- ONBOARDING LOGIC ---
    showOnboarding() {
        const modal = document.getElementById('modalOnboarding');
        if (modal) ModalUtils.open(modal);
    }

    hideOnboarding() {
        const modal = document.getElementById('modalOnboarding');
        if (modal) ModalUtils.close(modal);
    }

    initOnboardingListeners() {
        const form = document.getElementById('onboardingForm');
        const btnCancel = document.getElementById('btnCancelOnboarding');

        if (btnCancel) {
            btnCancel.addEventListener('click', async () => {
                if (confirm("Kurulumu iptal ederseniz hesabınız silinecek. Emin misiniz?")) {
                    eventBus.publish('SHOW_LOADING', true);
                    this.hideOnboarding();
                    await authService.deleteCurrentUser();
                    eventBus.publish('SHOW_LOADING', false);
                    eventBus.publish('SHOW_TOAST', { message: "Hesap silindi.", type: "info" });
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const aptName = document.getElementById('obAptName').value;
                const unitCount = Number(document.getElementById('obUnitCount').value);
                const termsCheck = document.getElementById('obTermsCheck').checked;
                const kvkkCheck = document.getElementById('obKvkkCheck').checked;

                if (!termsCheck || !kvkkCheck) {
                    eventBus.publish('SHOW_TOAST', { message: "Lütfen yasal metinleri onaylayın.", type: "error" });
                    return;
                }

                // VALIDATION: Batch Limit
                if (unitCount > 100) {
                    eventBus.publish('SHOW_TOAST', { message: "Güvenlik gereği en fazla 100 daire oluşturabilirsiniz.", type: "error" });
                    return;
                }

                eventBus.publish('SHOW_LOADING', true);
                try {
                    // Consent Verisi
                    const consentData = {
                        termsAccepted: true,
                        kvkkAccepted: true,
                        timestamp: new Date().toISOString(),
                        ip: "recorded_by_firebase_auth", // Client side IP is hard, usually server side.
                        userAgent: navigator.userAgent
                    };

                    // DbService call import here or use global dbService if available?
                    // AuthUI imports authService but not dbService directly properly? 
                    // Wait, AuthUI imports authService, logic uses dbService.
                    // IMPORTANT: I need to import dbService in AuthUI or access it.
                    // AuthUI.js imports: import { authService } from ...
                    // I'll add dbService import.
                    const { dbService } = await import("../../services/DbService.js");

                    await dbService.completeOnboarding(authService.currentUser, aptName, unitCount, consentData);

                    this.hideOnboarding();
                    eventBus.publish('SHOW_LOADING', false);
                    eventBus.publish('SHOW_TOAST', { message: "Kurulum tamamlandı! Hoş geldiniz.", type: "success" });

                    // Trigger dashboard refresh via Main.js logic or event
                    // Main.js listens to AUTH_STATE_CHANGED. 
                    // Since user is already logged in, AUTH_STATE_CHANGED won't fire again automatically?
                    // We should reload page or manually trigger UI update.
                    // Reloading is safest to clear any state.
                    window.location.reload();

                } catch (error) {
                    console.error(error);
                    eventBus.publish('SHOW_LOADING', false);
                    eventBus.publish('SHOW_TOAST', { message: "Kurulum hatası: " + error.message, type: "error" });
                }
            });
        }
    }
}