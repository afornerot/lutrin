// js/main.js
import { initRouter } from './router.js';
import { checkAuth } from './auth.js';
import { initApiStatus } from './services/apiStatus.js';

const UI_SCALE_KEY = 'lutrin_ui_scale';

function applySavedUiScale() {
    const saved = localStorage.getItem(UI_SCALE_KEY);
    if (saved) {
        document.body.style.setProperty('--ui-scale', saved);
    }
}

// Fonction principale qui démarre l'application
async function bootstrap() {
    console.log("Application Lutrin Client démarrée.");
    applySavedUiScale();
    initApiStatus();
    initRouter();
}

// Lancer l'application une fois que le DOM est prêt
document.addEventListener('DOMContentLoaded', bootstrap);
