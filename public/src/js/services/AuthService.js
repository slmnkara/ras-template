import { auth } from "../firebase-config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { eventBus } from "../core/EventManager.js";
import { dbService } from "./DbService.js";

class AuthService {
    constructor() {
        this.googleProvider = new GoogleAuthProvider();
    }

    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                eventBus.publish('AUTH_STATE_CHANGED', { user: user, isLoggedIn: true, isAnonymous: user.isAnonymous });
            } else {
                // Kullanıcı düştüğünde dinlemeyi durdur
                dbService.stopListening();
                eventBus.publish('AUTH_STATE_CHANGED', { user: null, isLoggedIn: false });
            }
        });
    }

    // 1. Normal Giriş (Yönetici)
    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            this.handleError(error);
        }
    }

    // 2. Kayıt Ol
    async register(email, password) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            eventBus.publish('SHOW_TOAST', { message: "Kayıt başarılı! Hoş geldiniz.", type: "success" });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    // 3. Google ile Giriş/Kayıt
    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, this.googleProvider);
            const isNewUser = result._tokenResponse?.isNewUser;
            if (isNewUser) {
                eventBus.publish('SHOW_TOAST', { message: "Google ile kayıt başarılı!", type: "success" });
            } else {
                eventBus.publish('SHOW_TOAST', { message: "Google ile giriş başarılı!", type: "success" });
            }
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    // 4. Anonim Giriş (Sakin)
    async loginAnonymously() {
        try {
            await signInAnonymously(auth);
            console.log("Anonim giriş yapıldı.");
        } catch (error) {
            console.error("Anonim giriş hatası:", error);
            eventBus.publish('SHOW_TOAST', { message: "Giriş yapılamadı.", type: "error" });
            throw error;
        }
    }

    async deleteCurrentUser() {
        if (auth.currentUser) {
            try {
                await deleteUser(auth.currentUser);
                dbService.stopListening();
            } catch (error) {
                console.warn("Hesap silinemedi (muhtemelen oturum süresi doldu). Çıkış yapılıyor...", error);
                // Eğer silinemiyorsa (ör: requires-recent-login), en azından çıkış yapalım.
                // Böylece kullanıcı verisi "yarım" kalsa bile erişim kesilir.
                // Gerçek senaryoda: Re-auth popup açılabilir ama şimdilik güvenli çıkış yeterli.
                await this.logout();
            }
        }
    }

    async logout() {
        dbService.stopListening();
        await signOut(auth);
    }

    handleError(error) {
        console.error("Auth Error:", error);

        // Loading ekranını kapat
        eventBus.publish('SHOW_LOADING', false);

        let msg = "İşlem başarısız.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            msg = "E-posta veya şifre hatalı.";
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Çok fazla başarısız deneme. Lütfen bekleyin.";
        } else if (error.code === 'auth/email-already-in-use') {
            msg = "Bu e-posta adresi zaten kullanılıyor.";
        } else if (error.code === 'auth/weak-password') {
            msg = "Şifre çok zayıf. Daha güçlü bir şifre seçin.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Geçersiz e-posta adresi.";
        } else if (error.code === 'auth/popup-closed-by-user') {
            msg = "Giriş penceresi kapatıldı.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            msg = "Giriş işlemi iptal edildi.";
        }

        eventBus.publish('SHOW_TOAST', { message: msg, type: "error" });
    }

    // Class'ın içine bu metodu ekle:
    get currentUser() {
        return auth.currentUser;
    }
}

export const authService = new AuthService();