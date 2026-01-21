export class Router {
    constructor() {
        this.views = {
            loading: document.getElementById('loadingScreen'),
            login: document.getElementById('loginView'),
            admin: document.getElementById('adminView'),
            resident: document.getElementById('residentView')
        };
    }

    // Tüm ekranları gizle
    hideAll() {
        Object.values(this.views).forEach(el => {
            if(el) el.classList.add('hidden-view');
        });
    }

    // İstenen ekranı göster
    navigate(viewName) {
        this.hideAll();
        const target = this.views[viewName];
        if (target) {
            target.classList.remove('hidden-view');
        } else {
            console.error(`Router: ${viewName} bulunamadı.`);
        }
    }

    // Loading ekranını aç/kapat
    toggleLoading(show) {
        if (this.views.loading) {
            if (show) this.views.loading.classList.remove('hidden-view');
            else this.views.loading.classList.add('hidden-view');
        }
    }
}

export const router = new Router();