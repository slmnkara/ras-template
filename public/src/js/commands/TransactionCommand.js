import { db, auth } from "../firebase-config.js";
import { doc, collection, runTransaction, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ValidationService } from "../services/ValidationService.js";

export class TransactionCommand {
    constructor(payload) {
        this.aciklama = ValidationService.validateText(payload.aciklama, 3, "Açıklama");
        this.tutar = ValidationService.validateAmount(payload.tutar);
        this.tur = payload.tur;
        this.createdDocId = null;
        // Eğer bu işlem bir tahsilatsa (PayDebtCommand tarafından oluşturulmuşsa) bu ID dolu gelir.
        this.related_debt_id = payload.related_debt_id || null;
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

            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            const newDocRef = doc(hareketlerRef);
            this.createdDocId = newDocRef.id;

            transaction.set(newDocRef, {
                tur: this.tur,
                aciklama: this.aciklama,
                tutar: this.tutar,
                timestamp: serverTimestamp(),
                is_correction: false,
                // Eğer varsa related_debt_id'yi de kaydet
                related_debt_id: this.related_debt_id
            });
        });
    }

    async undo() {
        if (this.related_debt_id) {
            throw new Error("Bu işlem bir 'Aidat Tahsilatı'dır. Geri almak için lütfen ilgili dairenin ödeme geçmişini veya Tahsilat logunu kullanın.");
        }

        const userId = auth.currentUser.uid;
        const kasaRef = doc(db, `yoneticiler/${userId}/kasa/ana_kasa`);
        const hareketlerRef = collection(db, `yoneticiler/${userId}/kasa/ana_kasa/hareketler`);

        const correctionDesc = `İPTAL: ${this.aciklama}`;

        await runTransaction(db, async (transaction) => {
            const kasaDoc = await transaction.get(kasaRef);
            const currentBalance = kasaDoc.data().toplam_bakiye || 0;

            let newBalance = currentBalance;
            // Bakiyeyi tersine çevir
            if (this.tur === 'gelir') newBalance -= this.tutar;
            else newBalance += this.tutar;

            transaction.update(kasaRef, { toplam_bakiye: newBalance });

            const undoDocRef = doc(hareketlerRef);

            // DÜZELTME BURADA:
            // reverseType mantığını kaldırdık. Türü (this.tur) koruyoruz.
            // ReportService: "tur===gelir && is_correction" ise Toplam Gelirden düşer.
            transaction.set(undoDocRef, {
                tur: this.tur, // <--- DEĞİŞTİ: Tür aynı kalmalı (gelir ise gelir)
                aciklama: correctionDesc,
                tutar: this.tutar,
                timestamp: serverTimestamp(),
                is_correction: true, // <--- Bu flag, rapor servisine "bunu toplamdan düş" der.
                original_ref: this.createdDocId
            });
        });
    }
}