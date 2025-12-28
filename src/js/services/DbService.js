import { db, auth } from "../firebase-config.js";
import { 
    collection, doc, addDoc, getDoc, updateDoc, 
    onSnapshot, runTransaction, serverTimestamp, setDoc,
    query, orderBy, limit, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { eventBus } from "../core/EventManager.js";
import { store } from "../core/Store.js"; // <--- STORE EKLENDİ

class DbService {
    constructor() {
        this.unsubKasa = null;
        this.unsubMeskenler = null;
    }

    getUserPath() {
        if (!auth.currentUser) throw new Error("Giriş yapılmadı!");
        return `yoneticiler/${auth.currentUser.uid}`;
    }

    // KULLANICI / ABONELİK KONTROLÜ
    async checkAndInitUser(user) {
        const userRef = doc(db, 'yoneticiler', user.uid);
        const docSnap = await getDoc(userRef);
        let userData;

        if (!docSnap.exists()) {
            // YENİ KULLANICI
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + 30); 

            userData = {
                email: user.email,
                kayit_tarihi: today.toISOString(),
                abonelik_bitis: endDate.toISOString(),
                abonelik_tipi: 'trial',
                max_daire: 15,
                resim_yukleme: false
            };
            await setDoc(userRef, userData);
        } else {
            userData = docSnap.data();
        }
        
        // Store'a kaydet
        store.setSubscription(userData);
        store.setUser(user);

        // Tarih Kontrolü
        const end = new Date(userData.abonelik_bitis);
        if (new Date() > end) {
            return false; // Süre bitmiş
        }
        
        // Profil verisi için event (Store zaten tutuyor ama UI tetiklenmesi için)
        eventBus.publish('SUBSCRIPTION_VALID', userData); 
        return true;
    }

    // VERİ AKIŞINI BAŞLAT (STORE'U BESLER)
    listenData() {
        if (!auth.currentUser) return;
        const userPath = this.getUserPath();

        // 1. Kasa Bakiyesi
        this.unsubKasa = onSnapshot(doc(db, `${userPath}/kasa/ana_kasa`), (docSnap) => {
            if (docSnap.exists()) {
                const val = docSnap.data().toplam_bakiye || 0;
                store.setBalance(val); // <--- STORE GÜNCELLENİYOR
            } else {
                setDoc(doc(db, `${userPath}/kasa/ana_kasa`), { toplam_bakiye: 0 });
            }
        });

        // 2. Kasa Hareketleri
        const qTransactions = query(collection(db, `${userPath}/kasa/ana_kasa/hareketler`), orderBy("timestamp", "desc"), limit(20));
        onSnapshot(qTransactions, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            store.setTransactions(list); // <--- STORE GÜNCELLENİYOR
        });

        // 3. Meskenler (Sadece Aktifler)
        // NOT: Veritabanı sorgusu yerine client-side filtreleme yapıyoruz şimdilik (index sorunu olmasın diye)
        this.unsubMeskenler = onSnapshot(collection(db, `${userPath}/meskenler`), (snap) => {
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                // Arşivlenmemişleri al
                if (data.aktif_mi !== false) {
                    list.push({ dbId: d.id, ...data });
                }
            });
            list.sort((a,b) => parseInt(a.kod) - parseInt(b.kod));
            store.setResidents(list); // <--- STORE GÜNCELLENİYOR
        });
    }

    // DİĞER İŞLEMLER (ADD, UPDATE, ARCHIVE)
    async addResident(ad, no) {
        const userPath = this.getUserPath();
        await addDoc(collection(db, `${userPath}/meskenler`), {
            sakin_adi: ad,
            kod: no,
            mesken_url: Math.random().toString(36).substring(2, 12),
            borclar: [],
            odemeler: [],
            aktif_mi: true
        });
    }

    async updateResident(dbId, newData) {
        const userPath = this.getUserPath();
        await updateDoc(doc(db, `${userPath}/meskenler`, dbId), newData);
    }

    async archiveResident(dbId) {
        const userPath = this.getUserPath();
        await updateDoc(doc(db, `${userPath}/meskenler`, dbId), {
            aktif_mi: false,
            arsiv_tarihi: new Date().toISOString()
        });
    }

    // SAKİN LİNKİ YENİLEME (GÜVENLİK İÇİN)
    async regenerateResidentLink(dbId) {
        const userPath = this.getUserPath();
        const newCode = Math.random().toString(36).substring(2, 12);
        await updateDoc(doc(db, `${userPath}/meskenler`, dbId), {
            mesken_url: newCode
        });
        return newCode;
    }

    // SAKİN GÖRÜNÜMÜ (READ-ONLY)
    async getResidentByUrl(uniqueUrl) {
        const { collectionGroup, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collectionGroup(db, 'meskenler'), where('mesken_url', '==', uniqueUrl));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    async getTransactionsByDate(startStr, endStr) {
        // startStr: "2025-03-01", endStr: "2025-03-31" (HTML input formatı)
        const { getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const userPath = this.getUserPath();
        const transactionsRef = collection(db, `${userPath}/kasa/ana_kasa/hareketler`);

        // Firestore'dan tüm geçmişi (veya makul bir miktarı) çekip JS tarafında filtreleyeceğiz.
        // Tarih formatımız string (DD.MM.YYYY) olduğu için DB sorgusu yerine JS filtresi daha güvenli.
        const snap = await getDocs(query(transactionsRef, orderBy("timestamp", "desc")));
        
        const startDate = new Date(startStr); startDate.setHours(0,0,0,0);
        const endDate = new Date(endStr); endDate.setHours(23,59,59,999);

        const list = [];
        snap.forEach(d => {
            const data = d.data();
            // Tarih verisini (DD.MM.YYYY) Date objesine çevir
            if(data.tarih) {
                const parts = data.tarih.split('.');
                const hDate = new Date(parts[2], parts[1]-1, parts[0]);
                
                if (hDate >= startDate && hDate <= endDate) {
                    list.push(data);
                }
            }
        });
        return list;
    }
}

export const dbService = new DbService();