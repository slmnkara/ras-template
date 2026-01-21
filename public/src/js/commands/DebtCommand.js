import { db, auth } from "../firebase-config.js";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ValidationService } from "../services/ValidationService.js";

export class DebtCommand {
    constructor(targetIds, debtData) {
        if (!targetIds || targetIds.length === 0) {
            throw new Error("Hiçbir daire seçilmedi!");
        }

        this.targetIds = targetIds;

        // Veriyi doğrula ve sakla
        const cleanDesc = ValidationService.validateText(debtData.aciklama, 3, "Borç Açıklaması");
        const cleanAmount = ValidationService.validateAmount(debtData.tutar);

        // ID'yi burada sabitliyoruz ki hem eklerken hem silerken aynı referansı kullanalım
        this.debtObject = {
            id: debtData.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
            timestamp: new Date(), // execute() sırasında serverTimestamp kullanılamaz (arrayUnion içinde), client tarafında Date kullanıyoruz
            aciklama: cleanDesc,
            tutar: cleanAmount
        };
    }

    async execute() {
        const userId = auth.currentUser.uid;

        const promises = this.targetIds.map(dbId => {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            return updateDoc(ref, {
                borclar: arrayUnion(this.debtObject)
            });
        });

        await Promise.all(promises);
    }

    async undo() {
        const userId = auth.currentUser.uid;

        // 1. KONTROL AŞAMASI: Bu borçlardan herhangi biri ödenmiş mi?
        // Tüm hedeflenen daireleri tek tek kontrol etmeliyiz.
        // Eğer tek bir daire bile ödeme yaptıysa, toplu işlem geri alınamaz.

        for (const dbId of this.targetIds) {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const data = snap.data();
                // Odemeler dizisinde bu borcun ID'si var mı?
                const isPaid = data.odemeler?.some(odeme => odeme.id === this.debtObject.id);

                if (isPaid) {
                    throw new Error(`Daire ${data.kod} (${data.sakin_adi}) bu borcu ödemiş görünüyor. Lütfen önce yapılan tahsilat işlemini geri alın.`);
                }
            }
        }

        // 2. UYGULAMA AŞAMASI: Hiçbir engel yoksa sil.
        const promises = this.targetIds.map(dbId => {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            return updateDoc(ref, {
                borclar: arrayRemove(this.debtObject)
            });
        });

        await Promise.all(promises);
    }
}