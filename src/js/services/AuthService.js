import { auth } from "../firebase-config.js"; 
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { eventBus } from "../core/EventManager.js";

class AuthService {
    // init() fonksiyonu main.js tarafından çağrılacak
    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Auth: Kullanıcı algılandı:", user.email);
                eventBus.publish('AUTH_STATE_CHANGED', { user: user, isLoggedIn: true });
            } else {
                console.log("Auth: Kullanıcı yok");
                eventBus.publish('AUTH_STATE_CHANGED', { user: null, isLoggedIn: false });
            }
        });
    }

    // 1. Normal Giriş
    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            this.handleError(error);
        }
    }

    // 2. Kayıt Ol (Register)
    async register(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Başarılı olursa onAuthStateChanged tetiklenir
            // Ancak bu yeni bir kullanıcı olduğu için veritabanında "initUser" yapılması gerektiğini bildirmeliyiz.
            // Bunu DbService içinde kontrol edeceğiz.
        } catch (error) {
            this.handleError(error);
        }
    }

    async logout() {
        await signOut(auth);
    }

    handleError(error) {
        console.error("Auth Error:", error);
        let msg = "İşlem başarısız.";
        if(error.code === 'auth/email-already-in-use') msg = "Bu e-posta zaten kullanımda.";
        if(error.code === 'auth/weak-password') msg = "Şifre en az 6 karakter olmalı.";
        if(error.code === 'auth/invalid-credential') msg = "Bilgiler hatalı.";
        
        eventBus.publish('LOGIN_ERROR', { code: msg }); // UI'a mesaj gönder
    }
}

export const authService = new AuthService();