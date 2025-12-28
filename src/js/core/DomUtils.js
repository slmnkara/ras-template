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