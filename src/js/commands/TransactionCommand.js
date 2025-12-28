import { db, auth } from "../firebase-config.js";
import { doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ValidationService } from "../services/ValidationService.js"; // Eklendi

export class TransactionCommand {
    constructor(payload) {
        // Validation Service burada devreye giriyor
        this.aciklama = ValidationService.validateText(payload.aciklama, 3, "Açıklama");
        this.tutar = ValidationService.validateAmount(payload.tutar);
        this.tur = payload.tur; // 'gelir' veya 'gider' (Selectbox olduğu için güveniyoruz ama yine de kontrol edilebilir)
        
        this.createdDocId = null;
    }

    async execute() {
        const userId = auth.currentUser.uid;
        const kasaRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const hareketlerRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);

        await runTransaction(db, async (transaction) => {
            const kasaDoc = await transaction.get(kasaRef);
            if (!kasaDoc.exists()) throw new Error("Kasa bulunamadı!");
            
            const currentBalance = kasaDoc.data().toplam_bakiye || 0;

            let newBalance = currentBalance;
            if (this.tur === 'gelir') newBalance += this.tutar;
            else newBalance -= this.tutar;

            // Kasa eksiye düşebilir mi? Kontrol eklenebilir.
            // if (newBalance < 0) throw new Error("Kasa bakiyesi yetersiz!");

            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            const newDocRef = doc(hareketlerRef); 
            this.createdDocId = newDocRef.id;

            transaction.set(newDocRef, {
                tur: this.tur,
                aciklama: this.aciklama,
                tutar: this.tutar,
                tarih: new Date().toLocaleDateString('tr-TR'),
                timestamp: serverTimestamp(),
                is_correction: false
            });
        });
    }

    async undo() {
        const userId = auth.currentUser.uid;
        const kasaRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const hareketlerRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);

        const reverseType = this.tur === 'gelir' ? 'gider' : 'gelir';
        const correctionDesc = `DÜZELTME: ${this.aciklama}`; 

        await runTransaction(db, async (transaction) => {
            const kasaDoc = await transaction.get(kasaRef);
            const currentBalance = kasaDoc.data().toplam_bakiye || 0;

            let newBalance = currentBalance;
            if (reverseType === 'gelir') newBalance += this.tutar;
            else newBalance -= this.tutar;

            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            const undoDocRef = doc(hareketlerRef);
            transaction.set(undoDocRef, {
                tur: reverseType,
                aciklama: correctionDesc,
                tutar: this.tutar,
                tarih: new Date().toLocaleDateString('tr-TR'),
                timestamp: serverTimestamp(),
                is_correction: true,
                original_ref: this.createdDocId
            });
        });
    }
}