import { dbService } from "./DbService.js";
import { store } from "../core/Store.js";

export class ReportService {

    /**
     * Excel raporunu oluşturur ve indirir.
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     */
    static async exportToExcel(startDate, endDate) {
        // 1. Verileri Hazırla
        const transactions = await dbService.getTransactionsByDate(startDate, endDate);
        const residents = store.residents; // Anlık sakin durumu (Store'dan)

        if (transactions.length === 0 && residents.length === 0) {
            throw new Error("Raporlanacak veri bulunamadı.");
        }

        // --- SAYFA 1: ÖZET TABLOSU ---
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            const val = parseFloat(t.tutar);
            // Düzeltme (is_correction) mantığına göre hesapla
            // Gelir ve düzeltme değilse -> Gelir
            // Gelir ve düzeltme ise (iptal) -> Gider gibi düş
            if (t.tur === 'gelir' && !t.is_correction) totalIncome += val;
            else if (t.tur === 'gelir' && t.is_correction) totalIncome -= val; // Gelir iptali
            else if (t.tur === 'gider' && !t.is_correction) totalExpense += val;
            else if (t.tur === 'gider' && t.is_correction) totalExpense -= val; // Gider iptali
        });

        const summaryData = [
            ["Rapor Tarihi", new Date().toLocaleDateString('tr-TR')],
            ["Dönem Başlangıcı", startDate.split('-').reverse().join('.')],
            ["Dönem Bitişi", endDate.split('-').reverse().join('.')],
            [], // Boş satır
            ["TOPLAM GELİR", totalIncome],
            ["TOPLAM GİDER", totalExpense],
            ["NET BAKİYE (Bu Dönem)", totalIncome - totalExpense],
            [],
            ["Not", "Bu rapor seçilen tarih aralığındaki hareketleri kapsar."]
        ];

        // --- SAYFA 2: KASA HAREKETLERİ ---
        const txHeader = ["Tarih", "Tür", "Açıklama", "Tutar (TL)", "Durum"];
        const txData = transactions.map(t => {
            let status = "Aktif";
            if (t.is_correction) status = "İPTAL EDİLDİ";

            // _formattedDate varsa (yeni) onu, yoksa tarih (eski) alanını kullan
            const displayDate = t._formattedDate || t.tarih || '';

            return [
                displayDate,
                t.tur.toUpperCase(),
                t.aciklama,
                parseFloat(t.tutar),
                status
            ];
        });
        txData.unshift(txHeader); // Başlığı ekle

        // --- SAYFA 3: DAİRE DURUMLARI (GÜNCEL) ---
        const resHeader = ["Daire No", "Sakin Adı", "Toplam Borç (TL)", "Durum"];
        const resData = residents.map(r => {
            const debt = r.borclar ? r.borclar.reduce((acc, b) => acc + parseFloat(b.tutar), 0) : 0;
            return [
                r.kod, // Sayı olarak kalsın ki sıralanabilsin
                r.sakin_adi,
                debt,
                r.aktif_mi === false ? "Eski Sakin" : "Aktif"
            ];
        });
        // Daire no'ya göre sırala
        resData.sort((a, b) => a[0] - b[0]);
        resData.unshift(resHeader);

        // 3. EXCEL DOSYASINI OLUŞTUR (XLSX kütüphanesi global window objesindedir)
        const wb = XLSX.utils.book_new();

        // Sayfaları oluştur
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        const wsTx = XLSX.utils.aoa_to_sheet(txData);
        const wsRes = XLSX.utils.aoa_to_sheet(resData);

        // Sütun Genişlikleri Ayarla (Görsellik)
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }];
        wsTx['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        wsRes['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 10 }];

        // Kitaba sayfaları ekle
        XLSX.utils.book_append_sheet(wb, wsSummary, "Genel Özet");
        XLSX.utils.book_append_sheet(wb, wsTx, "Kasa Hareketleri");
        XLSX.utils.book_append_sheet(wb, wsRes, "Daire Listesi");

        // 4. İNDİR
        const fileName = `Apt_Rapor_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
}