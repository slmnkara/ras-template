import { eventBus } from "./EventManager.js";

class Store {
    constructor() {
        // Uygulamanın anlık durumu
        this.state = {
            currentUser: null,      // Giriş yapmış yönetici bilgileri
            subscription: null,     // Abonelik detayları
            balance: 0,             // Anlık Kasa Bakiyesi
            residents: [],          // Tüm sakinlerin listesi (Arşiv dahil/hariç filtrelenebilir)
            transactions: [],       // Son kasa hareketleri
            appSettings: {}         // İleride eklenecek ayarlar
        };
    }

    // --- USER ACTIONS ---
    setUser(user) {
        this.state.currentUser = user;
        // Kullanıcı değiştiğinde diğer verileri temizle
        if (!user) {
            this.state.balance = 0;
            this.state.residents = [];
            this.state.transactions = [];
        }
    }

    setSubscription(data) {
        this.state.subscription = data;
    }

    // --- DATA ACTIONS ---
    
    // Kasa Bakiyesi Güncelle
    setBalance(amount) {
        this.state.balance = amount;
        // Veri değişince olay fırlat (UI bunu dinleyip güncellenecek)
        eventBus.publish('STATE_BALANCE_CHANGED', this.state.balance);
    }

    // Sakinleri Güncelle
    setResidents(list) {
        this.state.residents = list;
        eventBus.publish('STATE_RESIDENTS_CHANGED', this.state.residents);
    }

    // Hareketleri Güncelle
    setTransactions(list) {
        this.state.transactions = list;
        eventBus.publish('STATE_TRANSACTIONS_CHANGED', this.state.transactions);
    }

    // --- GETTERS (Veriyi Okumak İçin) ---
    get residents() { return this.state.residents; }
    get transactions() { return this.state.transactions; }
    get balance() { return this.state.balance; }
    get user() { return this.state.currentUser; }
    get subscription() { return this.state.subscription; }
}

// Singleton (Tekil) olarak dışarı açıyoruz. Herkes aynı hafızayı kullanacak.
export const store = new Store();