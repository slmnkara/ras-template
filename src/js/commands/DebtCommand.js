import { db, auth } from "../firebase-config.js";
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ValidationService } from "../services/ValidationService.js"; // Eklendi

export class DebtCommand {
    constructor(targetIds, debtData) {
        if (!targetIds || targetIds.length === 0) {
            throw new Error("Hiçbir daire seçilmedi!");
        }
        
        this.targetIds = targetIds;
        
        // Veriyi doğrula ve sakla
        const cleanDesc = ValidationService.validateText(debtData.aciklama, 3, "Borç Açıklaması");
        const cleanAmount = ValidationService.validateAmount(debtData.tutar);

        this.debtObject = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            tarih: new Date().toLocaleDateString('tr-TR'),
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

        const promises = this.targetIds.map(dbId => {
            const ref = doc(db, `yoneticiler/${userId}/meskenler`, dbId);
            return updateDoc(ref, {
                borclar: arrayRemove(this.debtObject) 
            });
        });

        await Promise.all(promises);
    }
}