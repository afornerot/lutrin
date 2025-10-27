// js/router.js
import { initLoginView } from './views/login.js';
import { initConsoleView } from './views/console.js';
import { initUserView } from './views/user.js';
import { checkAuth, logout } from './auth.js';

const routes = {
    '/login': { template: '/templates/login.html', init: initLoginView, public: true },
    '/console': { template: '/templates/console.html', init: initConsoleView },
    '/user': { template: '/templates/user.html', init: initUserView }
};

const appContainer = document.getElementById('app-container');
const headerContainer = document.getElementById('main-header');

async function navigate() {
    const path = window.location.pathname;
    const route = routes[path] || routes['/login']; // Fallback vers /login si la route n'est pas trouvée ou si on est à la racine "/"

    // Protéger les routes non publiques
    const isAuthenticated = checkAuth();
    if (!route.public && !isAuthenticated) {
        history.replaceState(null, '', '/login'); // Redirige sans ajouter à l'historique
        navigate(); // Appel récursif pour charger la nouvelle vue
        return;
    }

    // Si on est authentifié mais qu'on essaie d'aller sur /login, rediriger vers /user
    if (route.public && isAuthenticated) {
        history.replaceState(null, '', '/user'); // Redirige sans ajouter à l'historique
        navigate(); // Appel récursif pour charger la nouvelle vue
        return;
    }

    // Charger le template HTML de la vue
    const response = await fetch(route.template);
    if (!response.ok) {
        // Gérer les erreurs de chargement de template
        appContainer.innerHTML = `<p>Erreur: Impossible de charger la vue ${path}.</p>`;
        return;
    }
    appContainer.innerHTML = await response.text();

    // Exécuter le script d'initialisation de la vue
    if (route.init) {
        route.init();
    }
}

export function initRouter() {
    // Écouter les changements d'état de l'historique (boutons retour/avant du navigateur)
    window.addEventListener('popstate', navigate);

    // Intercepter les clics sur les liens pour gérer la navigation SPA
    document.addEventListener('click', e => {
        // Vérifier si le clic est sur un lien interne
        const link = e.target.closest('a');
        if (link && link.target !== '_blank' && link.origin === window.location.origin) {
            e.preventDefault(); // Empêcher la navigation par défaut
            navigateTo(link.pathname);
        }
    });

    // Charger la vue initiale
    navigate();
}

/**
 * Navigue vers un nouveau chemin, met à jour l'historique et rend la vue.
 * @param {string} path - Le chemin vers lequel naviguer (ex: '/user').
 */
export function navigateTo(path) {
    if (window.location.pathname !== path) {
        history.pushState(null, '', path);
        navigate();
    }
}
