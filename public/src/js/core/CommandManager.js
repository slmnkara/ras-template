import { eventBus } from "./EventManager.js";
import { db, auth } from "../firebase-config.js";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CommandFactory } from "./CommandFactory.js"; // <--- EKLENDİ

export class CommandManager {
    constructor() {
        this.history = []; // Bunu artık çok kullanmayacağız ama kalsın
    }

    async execute(command) {
        try {
            await command.execute();
            // 3. AUDIT LOG (Execute olarak kaydet)
            this.logAction(command, 'EXECUTE');
        } catch (err) {
            console.error("Komut Hatası:", err);
            eventBus.publish('SHOW_TOAST', { message: "İşlem başarısız: " + err.message, type: 'error' });
            throw err; // Hatayı yukarı fırlat ki UI bilsin
        }
    }

    // YENİ: LOG ÜZERİNDEN GERİ ALMA
    async undoFromLog(logItem) {
        if (!logItem || !logItem.details) return;

        try {
            // 1. JSON string'i objeye çevir
            const storedData = JSON.parse(logItem.details);
            
            // 2. Factory ile komutu canlandır
            const command = CommandFactory.rehydrate(logItem.command_name, storedData);
            
            if (!command) {
                throw new Error("Komut türü desteklenmiyor veya hatalı.");
            }

            // 3. Geri Al (Undo) işlemini çalıştır
            await command.undo();

            // 4. Log kaydını güncelle (Geri alındı diye işaretle)
            // Böylece tekrar geri alınmasını engelleriz
            if (auth.currentUser && logItem.id) {
                const logRef = doc(db, `yoneticiler/${auth.currentUser.uid}/audit_logs`, logItem.id);
                await updateDoc(logRef, { 
                    is_undone: true,
                    undone_at: serverTimestamp()
                });
            }

            eventBus.publish('SHOW_TOAST', { message: "İşlem başarıyla geri alındı.", type: 'success' });

        } catch (err) {
            console.error("Undo Hatası:", err);
            eventBus.publish('SHOW_TOAST', { message: "Geri alma başarısız: " + err.message, type: 'error' });
        }
    }

    // Eski undo metodunu devredışı bırakabilir veya logAction'ı koruyabilirsin.
    // ... logAction metodu aynı kalabilir ...
    async logAction(command, type) {
        if (!auth.currentUser) return;
        const logData = {
            action_type: type,
            command_name: command.constructor.name,
            timestamp: serverTimestamp(),
            user_email: auth.currentUser.email,
            details: JSON.stringify(command), // Komutun tüm iç durumunu kaydeder
            is_undone: false // Yeni özellik: Geri alınıp alınmadığını takip et
        };
        try {
            const logsRef = collection(db, `yoneticiler/${auth.currentUser.uid}/audit_logs`);
            await addDoc(logsRef, logData);
        } catch (e) {
            console.warn("Log hatası:", e);
        }
    }
}

export const commandManager = new CommandManager();