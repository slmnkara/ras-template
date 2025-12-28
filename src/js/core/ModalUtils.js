export class ModalUtils {
    
    /**
     * Modalı animasyonlu açar
     * @param {HTMLElement} modalEl 
     */
    static open(modalEl) {
        if (!modalEl) return;
        
        // 1. Önce hidden-view'ı kaldır (DOM'a girsin)
        modalEl.classList.remove('hidden-view');
        
        // 2. Tarayıcıya "Render" molası ver (Reflow) yoksa animasyon çalışmaz
        // (Bu hack, CSS transition'ın tetiklenmesi için şarttır)
        void modalEl.offsetWidth; 

        // 3. Göster sınıfını ekle (Opaklık ve Scale başlasın)
        modalEl.classList.add('show');
    }

    /**
     * Modalı animasyonlu kapatır
     * @param {HTMLElement} modalEl 
     */
    static close(modalEl) {
        if (!modalEl) return;

        // 1. Göster sınıfını kaldır (Geriye doğru animasyon başlasın)
        modalEl.classList.remove('show');

        // 2. Animasyon süresi (300ms) kadar bekle, sonra hidden-view ekle
        setTimeout(() => {
            modalEl.classList.add('hidden-view');
        }, 300); // CSS'teki süreyle aynı olmalı
    }
}