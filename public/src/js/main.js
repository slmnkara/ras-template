import { dbService } from "./services/DbService.js";
import { authService } from "./services/AuthService.js";
import { eventBus } from "./core/EventManager.js";
import { UIManager } from "./ui/UIManager.js";
import { APP_CONFIG } from "./config.js";

// Uygulama Başlatıcı
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Uygulama Bilgilerini DOM'a Yerleştir
    document.title = APP_CONFIG.name;

    // data-app-* attribute'larını doldur
    document.querySelectorAll('[data-app-name]').forEach(el => el.textContent = APP_CONFIG.name);
    document.querySelectorAll('[data-app-description]').forEach(el => el.textContent = APP_CONFIG.description);
    document.querySelectorAll('[data-app-version]').forEach(el => el.textContent = `v${APP_CONFIG.version}`);

    // 1. UI Yöneticisini Başlat
    const ui = new UIManager();

    // 2. URL Kontrolü (Sakin mi Yönetici mi?)
    const params = new URLSearchParams(window.location.search);
    const residentUrl = params.get('id');

    if (residentUrl) {
        // --- SAKİN GÖRÜNÜMÜ ---
        console.log("Sakin linki algılandı...");
        ui.toggleGlobalLoading(true);

        try {
            // Eğer zaten bir oturum varsa ama Anonim değilse (Yönetici ise), önce çıkış yap
            // Çünkü sakin linkine tıklayan kişi sakin olarak girmeli.
            if (authService.currentUser && !authService.currentUser.isAnonymous) {
                await authService.logout();
            }

            // Anonim Giriş Yap (Eğer zaten anonimse Firebase bunu halleder)
            await authService.loginAnonymously();

            const data = await dbService.getResidentByUrl(residentUrl);

            if (data) {
                ui.renderResidentView(data);
            } else {
                // Link hatalıysa temizlik yap
                await authService.logout();
                alert("Bu bağlantı geçersiz. Lütfen yöneticinizden güncel linki isteyiniz.");
                window.history.replaceState({}, document.title, window.location.pathname);
                location.reload();
            }
        } catch (error) {
            console.error("Sakin yükleme hatası:", error);
            alert("Sisteme erişilemedi. Lütfen sayfayı yenileyin.");
        } finally {
            ui.toggleGlobalLoading(false);
        }

    } else {
        // --- YÖNETİCİ GİRİŞİ ---

        // Auth Durumunu Dinle
        eventBus.subscribe('AUTH_STATE_CHANGED', async (state) => {

            // SENARYO 1: Kullanıcı Giriş Yapmış
            if (state.isLoggedIn) {

                // HATA DÜZELTMESİ BURADA:
                // Eğer giriş yapmış ama "Anonim" ise, bu bir Yönetici değildir!
                // Muhtemelen eski bir sakin oturumu kalmıştır. Çıkış yapıp login ekranını gösterelim.
                if (state.isAnonymous) {
                    console.log("Yönetici sayfasında Anonim oturum tespit edildi. Çıkış yapılıyor...");
                    await authService.logout();
                    return; // Fonksiyonu durdur, çıkış işlemi yeni bir event tetikleyecek (isLoggedIn: false)
                }

                // Gerçek Yönetici Girişi
                console.log("Yönetici girişi başarılı.");
                const hasAccess = await dbService.checkAndInitUser(state.user);

                if (hasAccess) {
                    dbService.listenData();
                    ui.showDashboard();
                } else {
                    ui.showSubscriptionLocked();
                }

            }
            // SENARYO 2: Kullanıcı Yok (Login Ekranı)
            else {
                console.log("Kullanıcı yok, giriş ekranı gösteriliyor.");
                ui.showLogin();
            }
        });

        // Auth Servisini Başlat
        authService.init();
    }
});