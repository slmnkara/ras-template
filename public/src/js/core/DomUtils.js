export const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`[DOM Error] Element #${id} bulunamadı. HTML'i kontrol et.`);
        // Null Object Pattern: Hata fırlatmak yerine "boş" bir element döneriz ki
        // sonraki .addEventListener çağrıları patlamasın.
        return document.createElement('div');
    }
    return el;
};

// innerHTML yerine kullanılacak güvenli text node oluşturucu
export const createEl = (tag, classes = '', text = '') => {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (text) el.textContent = text;
    return el;
};

/**
 * Firestore timestamp, Date objesi veya eski string tarihi (DD.MM.YYYY) 
 * TR formatına (DD.MM.YYYY) çevirir.
 * @param {Object|Date|string} value - timestamp alanı veya tarih değeri
 * @returns {string} - Formatlanmış tarih string'i
 */
export const formatTimestamp = (value) => {
    if (!value) return '';

    let date;

    // Firestore Timestamp objesi (toDate metodu var)
    if (value && typeof value.toDate === 'function') {
        date = value.toDate();
    }
    // JavaScript Date objesi
    else if (value instanceof Date) {
        date = value;
    }
    // Eski format: DD.MM.YYYY string
    else if (typeof value === 'string' && value.includes('.')) {
        const parts = value.split('.');
        if (parts.length === 3) {
            date = new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    // Eğer hala date oluşturulamadıysa, string olarak döndür
    if (!date || isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
    }

    return date.toLocaleDateString('tr-TR');
};

/**
 * Timestamp'ı Date objesine çevirir (hesaplama için)
 * @param {Object|Date|string} value 
 * @returns {Date|null}
 */
export const toDate = (value) => {
    if (!value) return null;

    if (value && typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string' && value.includes('.')) {
        const parts = value.split('.');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    return null;
};