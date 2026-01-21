import { TransactionCommand } from "../commands/TransactionCommand.js";
import { DebtCommand } from "../commands/DebtCommand.js";
import { PayDebtCommand } from "../commands/PayDebtCommand.js";

export class CommandFactory {
    /**
     * Log verisinden Komut Nesnesini yeniden yaratır.
     */
    static rehydrate(commandName, storedData) {
        let commandInstance = null;

        switch (commandName) {
            case 'TransactionCommand':
                commandInstance = new TransactionCommand({ tur: 'gelir', aciklama: 'dummy', tutar: '1' });
                break;
                
            case 'DebtCommand':
                // targetIds'i constructor'a verelim
                commandInstance = new DebtCommand(storedData.targetIds || ['dummy'], { aciklama: 'dummy', tutar: '1' });
                break;

            case 'PayDebtCommand':
                commandInstance = new PayDebtCommand(storedData.residentId || 'dummy', { id: 'dummy' });
                break;

            default:
                console.warn(`Bilinmeyen komut türü: ${commandName}`);
                return null;
        }

        // Veritabanındaki "gerçek" veriyi nesnenin üzerine yaz
        if (commandInstance) {
            Object.assign(commandInstance, storedData);
            
            // ÖNEMLİ DÜZELTME: DebtCommand'ın debtObject'ini manuel kontrol edelim.
            // Constructor yeni bir ID üretmiş olabilir, storedData'daki ID geçerli olmalı.
            if(commandName === 'DebtCommand' && storedData.debtObject) {
                commandInstance.debtObject = storedData.debtObject;
            }
        }

        return commandInstance;
    }
}