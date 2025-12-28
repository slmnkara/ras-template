import { AuthUI } from "./components/AuthUI.js";
import { DashboardUI } from "./components/DashboardUI.js";
import { ResidentUI } from "./components/ResidentUI.js";
import { AccountingUI } from "./components/AccountingUI.js";
import { ConfirmationUI } from "./components/ConfirmationUI.js";
import { router } from "../core/Router.js";
import { eventBus } from "../core/EventManager.js";
import { commandManager } from "../core/CommandManager.js";
import { ModalUtils } from "../core/ModalUtils.js"; // <--- UNUTMA

export class UIManager {
    constructor() {
        this.authUI = new AuthUI();
        this.dashboardUI = new DashboardUI();
        this.residentUI = new ResidentUI();
        this.accountingUI = new AccountingUI();
        this.confirmationUI = new ConfirmationUI();

        this.els = {
            loading: document.getElementById('loadingScreen'),
            btnUndo: document.getElementById('globalUndoBtn')
        };

        this.initGlobalListeners();
        this.initSubscribers();
    }

    toggleGlobalLoading(show) {
        if (show) this.els.loading.classList.remove('hidden-view');
        else this.els.loading.classList.add('hidden-view');
    }

    initGlobalListeners() {
        // 1. GLOBAL MODAL KAPATMA (İptal Butonları ve Backdrop)
        document.body.addEventListener('click', (e) => {
            // Tıklanan element VEYA onun ebeveyni "btn-close-modal" sınıfına sahip mi?
            const closeBtn = e.target.closest('.btn-close-modal');
            
            if (closeBtn) {
                const modal = closeBtn.closest('.modal-backdrop');
                if (modal) {
                    ModalUtils.close(modal);
                }
            }
            
            // Backdrop'a (gri alana) tıklanırsa
            if (e.target.classList.contains('modal-backdrop')) {
                ModalUtils.close(e.target);
            }
        });

        // 2. GERİ AL (UNDO)
        if (this.els.btnUndo) {
            this.els.btnUndo.addEventListener('click', () => {
                eventBus.publish('REQUEST_CONFIRM', {
                    title: "İşlemi Geri Al",
                    message: "Son işlem geri alınacak. Emin misiniz?",
                    onConfirm: () => commandManager.undo()
                });
            });
        }

        // 3. MOBİL SIDEBAR KONTROLÜ
        const btnMenu = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        let backdrop = document.getElementById('sidebarBackdrop');
        
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'sidebarBackdrop';
            backdrop.className = 'fixed inset-0 bg-gray-900/50 z-20 hidden transition-opacity opacity-0';
            document.body.appendChild(backdrop);
        }

        if (btnMenu && sidebar) {
            btnMenu.addEventListener('click', () => {
                sidebar.classList.remove('hidden');
                sidebar.classList.remove('-translate-x-full');
                backdrop.classList.remove('hidden');
                setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
            });

            const closeMenu = () => {
                sidebar.classList.add('-translate-x-full');
                backdrop.classList.add('opacity-0');
                setTimeout(() => {
                    backdrop.classList.add('hidden');
                }, 300);
            };

            backdrop.addEventListener('click', closeMenu);
            sidebar.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', closeMenu);
            });
        }
    }

    initSubscribers() {
        eventBus.subscribe('SHOW_LOADING', (show) => {
            if (show) this.els.loading.classList.remove('hidden-view');
            else this.els.loading.classList.add('hidden-view');
        });
    }

    showDashboard() {
        eventBus.publish('SHOW_LOADING', false);
        router.navigate('admin');
    }

    showLogin() {
        eventBus.publish('SHOW_LOADING', false);
        router.navigate('login');
    }

    showSubscriptionLocked() {
        eventBus.publish('SHOW_LOADING', false);
        document.body.innerHTML = `<div class="flex h-screen justify-center items-center">Abonelik Bitti.</div>`;
    }

    // --- SAKİN EKRANI (LIGHT MODE) ---
    renderResidentView(data) {
        eventBus.publish('SHOW_LOADING', false);
        router.navigate('resident');

        const elName = document.getElementById('resSakinAdi');
        const elNo = document.getElementById('resDaireNo');
        if(elName) elName.textContent = data.sakin_adi;
        if(elNo) elNo.textContent = `Daire: ${data.kod}`;

        const unpaidDiv = document.getElementById('resUnpaidList');
        unpaidDiv.innerHTML = ''; 
        
        if (data.borclar && data.borclar.length > 0) {
            data.borclar.forEach(b => {
                const row = document.createElement('div');
                row.className = "flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-3";
                
                const leftDiv = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.className = "font-semibold text-gray-800";
                titleDiv.textContent = b.aciklama;
                
                const dateDiv = document.createElement('div');
                dateDiv.className = "text-xs text-gray-500 mt-0.5";
                dateDiv.textContent = b.tarih;

                leftDiv.appendChild(titleDiv);
                leftDiv.appendChild(dateDiv);

                const rightDiv = document.createElement('div');
                rightDiv.className = "font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm";
                rightDiv.textContent = `${b.tutar} ₺`;

                row.appendChild(leftDiv);
                row.appendChild(rightDiv);
                unpaidDiv.appendChild(row);
            });

            const totalDebt = data.borclar.reduce((sum, item) => sum + parseFloat(item.tutar), 0);
            const wpBtn = document.createElement('a');
            const msg = `Merhaba, ben Daire ${data.kod} sakini ${data.sakin_adi}. Toplam ${totalDebt} TL tutarındaki borcumu ödedim, dekontu paylaşıyorum.`;
            wpBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            wpBtn.target = "_blank";
            wpBtn.className = "block w-full bg-green-600 hover:bg-green-500 text-white text-center py-3 rounded-lg font-bold mt-6 shadow-md transition transform hover:scale-[1.02]";
            wpBtn.innerHTML = '<i class="fab fa-whatsapp text-lg mr-2"></i> Ödeme Yaptım (WhatsApp Bildir)';
            unpaidDiv.appendChild(wpBtn);

        } else {
            unpaidDiv.innerHTML = `
                <div class="text-center py-8 bg-white rounded-lg border border-dashed border-gray-300">
                    <i class="fas fa-check-circle text-green-500 text-4xl mb-2"></i>
                    <p class="text-gray-500 font-medium">Harika! Hiç borcunuz yok.</p>
                </div>`;
        }

        const historyBody = document.getElementById('resHistoryBody');
        historyBody.innerHTML = '';
        if (data.odemeler) {
            data.odemeler.reverse().forEach(o => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-gray-100 last:border-0 hover:bg-gray-50";
                const tdDate = document.createElement('td'); tdDate.className = "p-3 text-gray-500 text-sm"; tdDate.textContent = o.odeme_tarihi;
                const tdDesc = document.createElement('td'); tdDesc.className = "p-3 text-gray-800 font-medium text-sm"; tdDesc.textContent = o.aciklama;
                const tdAmount = document.createElement('td'); tdAmount.className = "p-3 text-right font-bold text-gray-600 text-sm"; tdAmount.textContent = `${o.tutar} ₺`;
                tr.appendChild(tdDate); tr.appendChild(tdDesc); tr.appendChild(tdAmount);
                historyBody.appendChild(tr);
            });
        }
    }
}