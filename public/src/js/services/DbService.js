import { db, auth } from "../firebase-config.js";
import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    onSnapshot, runTransaction, serverTimestamp, setDoc,
    query, orderBy, limit, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { eventBus } from "../core/EventManager.js";
import { store } from "../core/Store.js";

class DbService {
    constructor() {
        this.unsubKasa = null;
        this.unsubMeskenler = null;

        this.listeners = {
            kasa: null,
            transactions: null,
            residents: null,
            templates: null
        };
    }

    // --- 1. DİNLEYİCİ YÖNETİMİ & UNSUBSCRIBE ---
    stopListening() {
        // Açık olan tüm dinleyicileri kapat
        Object.keys(this.listeners).forEach(key => {
            if (this.listeners[key]) {
                this.listeners[key](); // Unsubscribe fonksiyonunu çalıştır
                this.listeners[key] = null;
            }
        });
        console.log("Veri akışı durduruldu (Memory cleanup).");
    }

    // --- 2. VERİ AKIŞI (LISTENERS) ---
    listenData() {
        if (!auth.currentUser) return;
        this.stopListening(); // Önce eskileri temizle (Garanti olsun)

        const userPath = this.getUserPath();

        // A) Kasa Bakiyesi
        this.listeners.kasa = onSnapshot(doc(db, `${userPath}/kasa/ana_kasa`), (docSnap) => {
            if (docSnap.exists()) {
                store.setBalance(docSnap.data().toplam_bakiye || 0);
            } else {
                setDoc(doc(db, `${userPath}/kasa/ana_kasa`), { toplam_bakiye: 0 });
            }
        });

        // B) Kasa Hareketleri (Query Optimizasyonu: Sadece son 30 işlem)
        // Sıralamayı Timestamp ile yapıyoruz (String tarih ile değil)
        const qTransactions = query(
            collection(db, `${userPath}/kasa/ana_kasa/hareketler`),
            orderBy("timestamp", "desc"),
            limit(30)
        );
        this.listeners.transactions = onSnapshot(qTransactions, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            store.setTransactions(list);
        });

        // C) Sakinler (Query Optimizasyonu: Varsayılan sadece Aktifler)
        // UI tarafında "Arşiv" seçilirse ayrı bir metot çağrılmalı, 
        // ancak şimdilik senin yapını bozmadan hepsi yerine "aktif" olanları dinleyelim.
        const qResidents = query(
            collection(db, `${userPath}/meskenler`),
            orderBy("kod", "asc") // Daire no sıralaması (String ise '1, 10, 2' sorunu olabilir, numeric kontrol edilmeli)
        );

        this.listeners.residents = onSnapshot(qResidents, (snap) => {
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                // Client-side filtreleme yerine buraya 'where' eklenebilir 
                // ama sıralama (orderBy) ile çakışmaması için index gerekir.
                list.push({ dbId: d.id, ...data });
            });
            // Sayısal Sıralama Düzeltmesi
            list.sort((a, b) => {
                return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare(a.kod, b.kod);
            }); store.setResidents(list);
        });

        // D) Şablonlar
        const qTemplates = query(collection(db, `${userPath}/sablonlar`), orderBy("timestamp", "desc"));
        this.listeners.templates = onSnapshot(qTemplates, (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            eventBus.publish('STATE_TEMPLATES_CHANGED', list);
        });
    }

    // --- 3. AYNI DAİRE KONTROLÜ (VALIDATION) ---
    async checkDuplicateFlat(no) {
        const userPath = this.getUserPath();
        const q = query(
            collection(db, `${userPath}/meskenler`),
            where("kod", "==", no),
            where("aktif_mi", "==", true) // Sadece aktiflerde ara
        );
        const snap = await getDocs(q);
        return !snap.empty; // Varsa true döner
    }

    async addResident(ad, no) {
        // Önce kontrol et
        const isDuplicate = await this.checkDuplicateFlat(no);
        if (isDuplicate) {
            throw new Error(`Daire No: ${no} zaten kayıtlı!`);
        }

        const userPath = this.getUserPath();
        await addDoc(collection(db, `${userPath}/meskenler`), {
            sakin_adi: ad,
            kod: no,
            mesken_url: Math.random().toString(36).substring(2, 12),
            borclar: [],
            odemeler: [],
            aktif_mi: true,
            created_at: serverTimestamp() // Sıralama için Timestamp
        });
    }

    getUserPath() {
        if (!auth.currentUser) throw new Error("Giriş yapılmadı!");
        return `yoneticiler/${auth.currentUser.uid}`;
    }

    // KULLANICI / ABONELİK KONTROLÜ
    async checkUserDoc(uid) {
        if (!uid) return null;
        const userRef = doc(db, 'yoneticiler', uid);
        const docSnap = await getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    }

    async completeOnboarding(user, aptName, unitCount, consentData) {
        const userRef = doc(db, 'yoneticiler', user.uid);
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 30);

        const userData = {
            email: user.email,
            apartman_adi: aptName,
            daire_sayisi: Number(unitCount),
            kayit_tarihi: today.toISOString(),
            abonelik_bitis: endDate.toISOString(),
            abonelik_tipi: 'trial',
            resim_yukleme: false,
            consent: consentData,
            onboarding_completed: true
        };

        if (Number(unitCount) > 100) {
            throw new Error("Maksimum daire sayısı (100) aşıldı.");
        }

        // Batch write for atomicity
        const batch = writeBatch(db);
        batch.set(userRef, userData);

        // Firestore batch limit 500.
        for (let i = 1; i <= unitCount; i++) {
            const flatRef = doc(collection(db, `yoneticiler/${user.uid}/meskenler`));
            batch.set(flatRef, {
                sakin_adi: `Daire ${i}`,
                kod: i,
                mesken_url: Math.random().toString(36).substring(2, 12),
                borclar: [],
                odemeler: [],
                aktif_mi: true,
                created_at: serverTimestamp()
            });
        }

        await batch.commit();

        // Init store
        store.setSubscription(userData);
        store.setUser(user);
        return true;
    }
    async checkAndInitUser(user) {
        const userRef = doc(db, 'yoneticiler', user.uid);
        const docSnap = await getDoc(userRef);
        let userData;

        if (!docSnap.exists()) {
            return null; // Onboarding gerekli
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

        // Firestore'dan tüm geçmişi çekip JS tarafında filtreleyeceğiz.
        const snap = await getDocs(query(transactionsRef, orderBy("timestamp", "desc")));

        const startDate = new Date(startStr); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(endStr); endDate.setHours(23, 59, 59, 999);

        const list = [];
        snap.forEach(d => {
            const data = d.data();
            let hDate = null;

            // Önce timestamp alanını kontrol et (yeni format)
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                hDate = data.timestamp.toDate();
            }
            // Eski format: tarih string'i (DD.MM.YYYY)
            else if (data.tarih) {
                const parts = data.tarih.split('.');
                if (parts.length === 3) {
                    hDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }

            if (hDate && hDate >= startDate && hDate <= endDate) {
                // Formatlanmış tarihi ekle (rapor için)
                data._formattedDate = hDate.toLocaleDateString('tr-TR');
                list.push(data);
            }
        });
        return list;
    }

    async addTemplate(data) {
        const userPath = this.getUserPath();
        // Dynamic import'a gerek yok, yukarıda var
        await addDoc(collection(db, `${userPath}/sablonlar`), {
            ...data,
            timestamp: serverTimestamp()
        });
    }

    async deleteTemplate(id) {
        const userPath = this.getUserPath();
        // Dynamic import'a gerek yok, yukarıya ekledik
        await deleteDoc(doc(db, `${userPath}/sablonlar`, id));
    }

    // --- POST-IT NOT İŞLEMLERİ (YENİ) ---
    async getAdminNote() {
        const userPath = this.getUserPath();
        // 'ayarlar' koleksiyonu altında 'pano' dökümanı
        const docRef = doc(db, `${userPath}/ayarlar/pano`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().text || "";
        }
        return "";
    }

    async saveAdminNote(text) {
        const userPath = this.getUserPath();
        const docRef = doc(db, `${userPath}/ayarlar/pano`);
        // setDoc ile merge:true kullanıyoruz ki varsa üzerine yazsın, yoksa oluştursun
        await setDoc(docRef, {
            text: text,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    // ... diğer metodlar ...

    // SON 24 SAATLİK LOGLARI GETİR
    async getRecentAuditLogs() {
        const userPath = this.getUserPath();
        const { query, orderBy, where, getDocs, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        // Son 24 saat hesaplaması
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const logsRef = collection(db, `${userPath}/audit_logs`);
        // Sadece son 24 saati getir ve yeniden eskiye sırala
        const q = query(
            logsRef,
            where("timestamp", ">=", yesterday),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() });
        });
        return list;
    }
}

export const dbService = new DbService();