import { db, auth } from "../firebase-config.js";
import { doc, runTransaction, serverTimestamp, arrayUnion, arrayRemove, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class PayDebtCommand {
    constructor(residentId, debtObject) {
        this.residentId = residentId;
        this.debtObject = debtObject;
        this.safeTransactionId = null;
    }

    // ... execute() metodu AYNI kalıyor ...
    async execute() {
        // (Buradaki kodların değişmesine gerek yok, aynen koruyun)
        // Sadece kolaylık olsun diye referans:
        const userId = auth.currentUser.uid;
        const residentRef = doc(db, `yoneticiler/${userId}/meskenler`, this.residentId);
        const safeRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);

        await runTransaction(db, async (transaction) => {
            const resDoc = await transaction.get(residentRef);
            const safeDoc = await transaction.get(safeRef);
            if (!resDoc.exists()) throw new Error("Sakin bulunamadı");

            const borclar = resDoc.data().borclar || [];
            const targetDebt = borclar.find(b => b.id === this.debtObject.id);
            if (!targetDebt) throw new Error("Bu borç zaten ödenmiş veya silinmiş.");

            const paymentObj = { ...targetDebt, odeme_timestamp: new Date(), islem_id: Date.now() };
            const newSafeBalance = (safeDoc.data()?.toplam_bakiye || 0) + parseFloat(targetDebt.tutar);

            const safeTxId = "tx_" + Date.now();
            this.safeTransactionId = safeTxId;
            const newTxRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`, safeTxId);

            transaction.update(residentRef, { borclar: arrayRemove(targetDebt), odemeler: arrayUnion(paymentObj) });
            transaction.update(safeRef, { toplam_bakiye: newSafeBalance });
            transaction.set(newTxRef, {
                tur: 'gelir',
                aciklama: `TAHSİLAT: ${resDoc.data().kod} - ${targetDebt.aciklama}`,
                tutar: parseFloat(targetDebt.tutar),
                timestamp: serverTimestamp(),
                is_correction: false,
                related_debt_id: targetDebt.id
            });
        });
    }

    // --- DÜZELTİLEN KISIM: UNDO ---
    async undo() {
        const userId = auth.currentUser.uid;
        const residentRef = doc(db, `yoneticiler/${userId}/meskenler`, this.residentId);
        const safeRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);

        // DİKKAT: Artık eski hareketi silmek için referans almıyoruz,
        // yeni bir "İPTAL" hareketi oluşturmak için koleksiyon referansı alıyoruz.
        const logsCollectionRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);
        const newUndoRef = doc(logsCollectionRef); // Yeni bir ID üretir

        await runTransaction(db, async (transaction) => {
            const resDoc = await transaction.get(residentRef);
            const safeDoc = await transaction.get(safeRef);

            // Ödemeyi bul
            const odemeler = resDoc.data().odemeler || [];
            const targetPayment = odemeler.find(p => p.id === this.debtObject.id);

            if (!targetPayment) throw new Error("Geri alınacak ödeme bulunamadı (Zaten geri alınmış olabilir).");

            // Kasa Bakiyesini Düşür
            const newSafeBalance = (safeDoc.data()?.toplam_bakiye || 0) - parseFloat(this.debtObject.tutar);

            // 1. Sakin Kayıtlarını Düzelt (Ödemeyi sil, borcu geri ekle)
            transaction.update(residentRef, {
                odemeler: arrayRemove(targetPayment),
                borclar: arrayUnion(this.debtObject)
            });

            // 2. Kasa Bakiyesini Güncelle
            transaction.update(safeRef, { toplam_bakiye: newSafeBalance });

            // 3. İPTAL KAYDI OLUŞTUR (Silmek yerine ekle)
            // ÖNEMLİ: Türü 'gelir' olarak bırakıyoruz ama is_correction: true yapıyoruz.
            // Böylece Rapor servisi bunu "Gelirden Düşülecek" kalem olarak algılayacak.
            transaction.set(newUndoRef, {
                tur: 'gelir',
                aciklama: `İPTAL: Tahsilat - ${this.debtObject.aciklama}`,
                tutar: parseFloat(this.debtObject.tutar),
                timestamp: serverTimestamp(),
                is_correction: true, // <--- BU ALAN RAPORLAMA İÇİN KRİTİK
                original_ref: this.safeTransactionId
            });
        });
    }
}