// js/main.js
import { initRouter } from './router.js';
import { checkAuth } from './auth.js';
import { initApiStatus } from './services/apiStatus.js';

/**
 * Charge les templates globaux (non liés à une vue) et les injecte dans le DOM.
 */
async function loadGlobalTemplates() {
    const templatesToLoad = [
        '/templates/offline.html',
        '/templates/settings.html'
    ];

    try {
        const responses = await Promise.all(templatesToLoad.map(url => fetch(url)));
        const htmlContents = await Promise.all(responses.map(res => res.text()));

        // Injecte chaque template au début du body
        htmlContents.forEach(html => document.body.insertAdjacentHTML('afterbegin', html));
    } catch (error) {
        console.error("Impossible de charger les templates globaux:", error);
    }
}

// Fonction principale qui démarre l'application
async function bootstrap() {
    console.log("Application Lutrin Client démarrée.");
    await loadGlobalTemplates(); // Charger les templates globaux en premier
    initApiStatus(); // Initialise la surveillance de l'API
    initRouter(); // Initialise le routeur qui gère les changements de vue
}

// Lancer l'application une fois que le DOM est prêt
document.addEventListener('DOMContentLoaded', bootstrap);
