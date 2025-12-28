export class ValidationService {
    
    /**
     * Metin girişlerini temizler ve kontrol eder.
     * @param {string} text - Kontrol edilecek metin
     * @param {number} minLength - Minimum uzunluk
     * @param {string} fieldName - Hata mesajı için alan adı
     */
    static validateText(text, minLength = 2, fieldName = "Alan") {
        if (!text || typeof text !== 'string') {
            throw new Error(`${fieldName} boş olamaz.`);
        }
        const trimmed = text.trim();
        if (trimmed.length < minLength) {
            throw new Error(`${fieldName} en az ${minLength} karakter olmalıdır.`);
        }
        // Basit XSS temizliği (HTML taglerini engelle)
        if (/<[^>]*>/g.test(trimmed)) {
            throw new Error(`${fieldName} geçersiz karakterler içeriyor.`);
        }
        return trimmed;
    }

    /**
     * Para birimi kontrolü (Pozitif sayı olmalı)
     */
    static validateAmount(amount) {
        const val = parseFloat(amount);
        if (isNaN(val)) {
            throw new Error("Tutar sayısal bir değer olmalıdır.");
        }
        if (val <= 0) {
            throw new Error("Tutar 0'dan büyük olmalıdır.");
        }
        // Virgülden sonra 2 hane formatına zorla
        return parseFloat(val.toFixed(2));
    }

    /**
     * E-posta format kontrolü
     */
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(String(email).toLowerCase())) {
            throw new Error("Geçersiz e-posta adresi.");
        }
        return email.trim();
    }
}