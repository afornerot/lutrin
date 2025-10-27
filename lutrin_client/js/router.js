// js/router.js
import { initLoginView } from './views/login.js';
import { initConsoleView } from './views/console.js';
import { initUserView } from './views/user.js';
import { checkAuth, logout } from './auth.js';

const routes = {
    '#/login': { template: '/templates/login.html', init: initLoginView, public: true },
    '#/console': { template: '/templates/console.html', init: initConsoleView },
    '#/user': { template: '/templates/user.html', init: initUserView }
};

const appContainer = document.getElementById('app-container');
const headerContainer = document.getElementById('main-header');

async function navigate() {
    const path = window.location.hash || '#/login';
    const route = routes[path];

    if (!route) {
        // Gérer les routes 404 si nécessaire, pour l'instant on redirige vers le login
        window.location.hash = '#/login';
        return;
    }

    // Protéger les routes non publiques
    const isAuthenticated = checkAuth();
    if (!route.public && !isAuthenticated) {
        window.location.hash = '#/login';
        return;
    }

    // Si on est authentifié mais qu'on essaie d'aller sur /login, rediriger vers /user
    if (route.public && isAuthenticated) {
        window.location.hash = '#/user';
        return;
    }

    // Charger le template HTML de la vue
    const response = await fetch(route.template);
    if (!response.ok) {
        appContainer.innerHTML = `<p>Erreur: Impossible de charger la vue.</p>`;
        return;
    }
    appContainer.innerHTML = await response.text();

    // Exécuter le script d'initialisation de la vue
    if (route.init) {
        route.init();
    }
}

export function initRouter() {
    // Écouter les changements de hash dans l'URL
    window.addEventListener('hashchange', navigate);

    // Charger la vue initiale
    navigate();
}
