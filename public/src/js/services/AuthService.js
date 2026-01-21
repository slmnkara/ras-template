import { auth } from "../firebase-config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously // <--- YENİ: Import edildi
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { eventBus } from "../core/EventManager.js";
import { dbService } from "./DbService.js"; // <--- EKLENDİ

class AuthService {
    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                eventBus.publish('AUTH_STATE_CHANGED', { user: user, isLoggedIn: true, isAnonymous: user.isAnonymous });
            } else {
                // Kullanıcı düştüğünde dinlemeyi durdur
                dbService.stopListening(); // <--- KRİTİK EKLEME
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

    // 2. Anonim Giriş (Sakin) - YENİ METOT
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

    async logout() {
        dbService.stopListening(); // <--- KRİTİK EKLEME
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
        }

        eventBus.publish('SHOW_TOAST', { message: msg, type: "error" });
    }

    // Class'ın içine bu metodu ekle:
    get currentUser() {
        return auth.currentUser;
    }
}

export const authService = new AuthService();