import { eventBus } from "./EventManager.js";
import { db, auth } from "../firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class CommandManager {
    constructor() {
        this.history = [];
    }

    async execute(command) {
        try {
            // 1. Komutu Çalıştır
            await command.execute();
            
            // 2. Geçmişe Ekle (Undo için)
            this.history.push(command);
            
            // 3. AUDIT LOG (Kayıt Tut)
            this.logAction(command, 'EXECUTE');

            console.log(`Komut İşlendi: ${command.constructor.name}`);
        } catch (err) {
            console.error("Komut Hatası:", err);
            eventBus.publish('SHOW_TOAST', { message: "İşlem başarısız: " + err.message, type: 'error' });
        }
    }

    async undo() {
        const command = this.history.pop();
        if (!command) {
            eventBus.publish('SHOW_TOAST', { message: "Geri alınacak işlem yok.", type: 'warning' });
            return;
        }

        try {
            await command.undo();
            
            // AUDIT LOG (Geri Alma İşlemi)
            this.logAction(command, 'UNDO');

            console.log(`Komut Geri Alındı: ${command.constructor.name}`);
            eventBus.publish('SHOW_TOAST', { message: "İşlem geri alındı.", type: 'success' });
        } catch (err) {
            console.error("Geri Alma Hatası:", err);
            this.history.push(command); 
            eventBus.publish('SHOW_TOAST', { message: "Geri alma başarısız oldu.", type: 'error' });
        }
    }

    /**
     * İşlemi veritabanına loglar (Arka planda çalışır, kullanıcıyı bekletmez)
     */
    async logAction(command, type) {
        if (!auth.currentUser) return;

        const logData = {
            action_type: type, // EXECUTE veya UNDO
            command_name: command.constructor.name,
            timestamp: serverTimestamp(),
            user_email: auth.currentUser.email,
            details: JSON.stringify(command) // Komutun içindeki veriyi string olarak sakla
        };

        try {
            const userId = auth.currentUser.uid;
            // 'audit_logs' koleksiyonuna yaz
            const logsRef = collection(db, `yoneticiler/${userId}/audit_logs`);
            // await kullanmıyoruz, loglama işlemi UI'ı bloklamasın.
            addDoc(logsRef, logData).catch(e => console.warn("Log hatası:", e));
        } catch (e) {
            console.warn("Log oluşturulamadı:", e);
        }
    }
}

export const commandManager = new CommandManager();