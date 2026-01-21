import { AuthUI } from "./components/AuthUI.js";
import { DashboardUI } from "./components/DashboardUI.js";
import { ResidentUI } from "./components/ResidentUI.js";
import { AccountingUI } from "./components/AccountingUI.js";
import { ConfirmationUI } from "./components/ConfirmationUI.js";
import { TemplateUI } from "./components/TemplateUI.js";
import { router } from "../core/Router.js";
import { eventBus } from "../core/EventManager.js";
import { commandManager } from "../core/CommandManager.js";
import { ModalUtils } from "../core/ModalUtils.js";
import { formatTimestamp } from "../core/DomUtils.js";
import { AuditLogUI } from "./components/AuditLogUI.js";
import { APP_CONFIG } from "../config.js";

export class UIManager {
    constructor() {
        this.authUI = new AuthUI();
        this.dashboardUI = new DashboardUI();
        this.residentUI = new ResidentUI();
        this.accountingUI = new AccountingUI();
        this.confirmationUI = new ConfirmationUI();
        this.templateUI = new TemplateUI();
        this.auditLogUI = new AuditLogUI(); // <--- EKLENDİ

        this.els = {
            loading: document.getElementById('loadingScreen'),
            btnUndo: document.getElementById('globalUndoBtn'),
            navTemplates: document.getElementById('navTemplates'),

            // DÜZELTME BURADA: Doğrudan ID'leri seçiyoruz.
            views: {
                dashboard: document.getElementById('dashboardContent'),
                templates: document.getElementById('templatesView')
            }
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

        // 4. NAVİGASYON (Dashboard ve Şablonlar Arası Geçiş)
        if (this.els.navTemplates) {
            // Dashboard Linki (Özet Durum)
            const dashboardLink = document.querySelector('a[href="#"]'); // veya ID verip seçin

            // Yeni "Şablonlar" linki
            this.els.navTemplates.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab('templates');
            });

            // "Özet Durum" linki
            if (dashboardLink) {
                dashboardLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab('dashboard');
                });
            }
        }

        // 5. PARA GİRİŞLERİNİ FORMATLA (Otomatik Nokta/Virgül)
        // class="currency-input" olan tüm inputları dinler
        document.body.addEventListener('focusout', (e) => {
            if (e.target.classList.contains('currency-input')) {
                let val = e.target.value;
                if (!val) return;

                // Temizle: Noktaları kaldır, virgülü noktaya çevir (ValidationService mantığı)
                // Amaç: Geçerli bir sayı olup olmadığını anlamak
                let clean = val.replace(/\./g, '').replace(',', '.');
                let number = parseFloat(clean);

                if (!isNaN(number)) {
                    // TR Formatına çevirip inputa geri yaz: "1.500,50"
                    e.target.value = new Intl.NumberFormat('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(number);
                }
            }
        });
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

        document.body.innerHTML = `
            <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-lock text-3xl text-red-600"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800 mb-2">Süreniz Doldu</h2>
                    <p class="text-slate-500 mb-6">Hizmeti kullanmaya devam etmek için lütfen yönetici ile iletişime geçerek aboneliğinizi yenileyin.</p>
                    <a href="mailto:${APP_CONFIG.contact.email}" 
                       class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-all">
                        <i class="fas fa-envelope"></i>
                        İletişime Geç
                    </a>
                    <p class="text-xs text-slate-400 mt-4">${APP_CONFIG.contact.email}</p>
                </div>
            </div>
        `;
    }

    // --- SAKİN EKRANI (LIGHT MODE) ---
    renderResidentView(data) {
        eventBus.publish('SHOW_LOADING', false);
        router.navigate('resident');

        const elName = document.getElementById('resSakinAdi');
        const elNo = document.getElementById('resDaireNo');
        if (elName) elName.textContent = data.sakin_adi;
        if (elNo) elNo.textContent = `Daire: ${data.kod}`;

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
                dateDiv.textContent = formatTimestamp(b.timestamp) || formatTimestamp(b.tarih);

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
                const tdDate = document.createElement('td'); tdDate.className = "p-3 text-gray-500 text-sm"; tdDate.textContent = formatTimestamp(o.odeme_timestamp) || formatTimestamp(o.odeme_tarihi);
                const tdDesc = document.createElement('td'); tdDesc.className = "p-3 text-gray-800 font-medium text-sm"; tdDesc.textContent = o.aciklama;
                const tdAmount = document.createElement('td'); tdAmount.className = "p-3 text-right font-bold text-gray-600 text-sm"; tdAmount.textContent = `${o.tutar} ₺`;
                tr.appendChild(tdDate); tr.appendChild(tdDesc); tr.appendChild(tdAmount);
                historyBody.appendChild(tr);
            });
        }
    }

    switchTab(tabName) {
        // Aktif/Pasif link stilleri
        const activeClass = "bg-indigo-50/80 text-indigo-700 border-indigo-100";
        const inactiveClass = "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent";

        const dashboardLink = document.querySelector('a[href="#"]');

        // Önce hepsini gizle (Güvenli yöntem)
        if (this.els.views.dashboard) this.els.views.dashboard.classList.add('hidden-view');
        if (this.els.views.templates) this.els.views.templates.classList.add('hidden-view');

        // İstenen sekmeyi aç
        if (tabName === 'templates') {
            this.templateUI.show(); // TemplateUI kendi içindeki view'i açar

            // Link Stilleri (Şablonlar Aktif)
            this.els.navTemplates?.classList.add(...activeClass.split(' '));
            this.els.navTemplates?.classList.remove(...inactiveClass.split(' '));
            dashboardLink?.classList.remove(...activeClass.split(' '));
            dashboardLink?.classList.add(...inactiveClass.split(' '));

        } else {
            // Dashboard Aktif
            if (this.els.views.dashboard) this.els.views.dashboard.classList.remove('hidden-view');
            this.templateUI.hide();

            // Link Stilleri (Dashboard Aktif)
            dashboardLink?.classList.add(...activeClass.split(' '));
            dashboardLink?.classList.remove(...inactiveClass.split(' '));
            this.els.navTemplates?.classList.remove(...activeClass.split(' '));
            this.els.navTemplates?.classList.add(...inactiveClass.split(' '));
        }
    }
}