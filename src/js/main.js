import { dbService } from "./services/DbService.js";
import { authService } from "./services/AuthService.js";
import { eventBus } from "./core/EventManager.js";
import { UIManager } from "./ui/UIManager.js";

// Uygulama Başlatıcı
document.addEventListener('DOMContentLoaded', async () => {
    // 1. UI Yöneticisini Başlat (O da alt bileşenleri başlatacak)
    const ui = new UIManager();

    // 2. URL Kontrolü (Sakin mi Yönetici mi?)
    const params = new URLSearchParams(window.location.search);
    const residentUrl = params.get('id');

    if (residentUrl) {
        // --- SAKİN GÖRÜNÜMÜ (READ-ONLY) ---
        console.log("Sakin girişi algılandı...");
        // Loading aç
        ui.toggleGlobalLoading(true);
        
        try {
            const data = await dbService.getResidentByUrl(residentUrl);
            if (data) {
                // Sakin ekranını yükle (Bu fonksiyonu ResidentUI içinde tanımlayacağız)
                // Şimdilik UIManager üzerinden yönlendiriyoruz
                ui.renderResidentView(data);
            } else {
                alert("Bu bağlantı geçersiz veya süresi dolmuş (Yönetici tarafından yenilenmiş olabilir). Lütfen yöneticinizden güncel linki isteyiniz.");
                // URL'i temizle
                window.history.replaceState({}, document.title, window.location.pathname);
                location.reload();
            }
        } catch (error) {
            console.error(error);
            alert("Veri yüklenirken hata oluştu.");
        } finally {
            ui.toggleGlobalLoading(false);
        }

    } else {
        // --- YÖNETİCİ GİRİŞİ ---
        
        // Auth Durumunu Dinle
        eventBus.subscribe('AUTH_STATE_CHANGED', async (state) => {
            if (state.isLoggedIn) {
                console.log("Yönetici girişi başarılı.");
                
                // Kullanıcıyı veritabanında kontrol et / oluştur (Deneme süresi vs.)
                const hasAccess = await dbService.checkAndInitUser(state.user);

                if (hasAccess) {
                    // Veri akışını başlat
                    dbService.listenData();
                    // Dashboard'u göster
                    ui.showDashboard();
                } else {
                    // Abonelik bitmişse
                    ui.showSubscriptionLocked();
                }
            } else {
                console.log("Kullanıcı çıkış yaptı.");
                ui.showLogin();
            }
        });

        // Auth Servisini Başlat
        authService.init();
    }
});