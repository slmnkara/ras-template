export class ValidationService {
    
    // ... validateText fonksiyonu aynen kalıyor ...
    static validateText(text, minLength = 2, fieldName = "Alan") {
        if (!text || typeof text !== 'string') {
            throw new Error(`${fieldName} boş olamaz.`);
        }
        const trimmed = text.trim();
        if (trimmed.length < minLength) {
            throw new Error(`${fieldName} en az ${minLength} karakter olmalıdır.`);
        }
        if (/<[^>]*>/g.test(trimmed)) {
            throw new Error(`${fieldName} geçersiz karakterler içeriyor.`);
        }
        return trimmed;
    }

    /**
     * TR Para birimi kontrolü ve Dönüştürme
     * Girdi: "1.500,50" veya "1500,50" veya 1500.50
     * Çıktı: 1500.50 (Float)
     */
    static validateAmount(amount) {
        if (amount === null || amount === undefined || amount === '') {
            throw new Error("Tutar boş olamaz.");
        }

        let cleanAmount = amount.toString();

        // 1. Senaryo: Kullanıcı "1.500" yazdı (1500 TL)
        // 2. Senaryo: Kullanıcı "1,500" yazdı (1.5 TL veya 1500 TL? TR standardında virgül ondalıktır)
        // TR Standardı: 1.500,50 (Binlik nokta, ondalık virgül)
        
        // Tüm noktaları (binlik ayraç) kaldır
        cleanAmount = cleanAmount.replace(/\./g, '');
        
        // Virgülü noktaya çevir (JS ondalık formatı için)
        cleanAmount = cleanAmount.replace(',', '.');

        const val = parseFloat(cleanAmount);

        if (isNaN(val)) {
            throw new Error("Tutar sayısal olmalıdır. (Örn: 1500 veya 1.500,50)");
        }
        if (val < 0) { // 0'a izin verilebilir belki ama negatif olmaz
            throw new Error("Tutar negatif olamaz.");
        }
        
        // Veritabanı için 2 ondalık basamaklı sayı (float) döndür
        return parseFloat(val.toFixed(2));
    }

    // ... validateEmail fonksiyonu aynen kalıyor ...
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(String(email).toLowerCase())) {
            throw new Error("Geçersiz e-posta adresi.");
        }
        return email.trim();
    }

    static sanitize(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}