// js/router.js
import { initLoginView } from './views/login.js';
import { initConsoleView } from './views/console.js';
import { initUserView } from './views/user.js';
import { initEpubDetailView } from './views/epub.js';
import { initEpubsView } from './views/epubs.js';
import { initHeader, updateHeaderNav } from './services/ui.js';
import { checkAuth, getAuthUserRole } from './auth.js';

const routes = {
    '/login': { template: '/templates/login.html', init: initLoginView, public: true },
    '/epub': { template: '/templates/epub.html', init: initEpubDetailView },
    '/console': { template: '/templates/console.html', init: initConsoleView, requiresAdmin: true },
    '/user': { template: '/templates/user.html', init: initUserView },
    '/epubs': { template: '/templates/epubs.html', init: initEpubsView }
};

const appContainer = document.getElementById('app-container');
const headerContainer = document.getElementById('main-header');

let currentCleanupFunction = null; // Pour stocker la fonction de nettoyage de la vue actuelle

async function navigate() {
    const path = window.location.pathname.split('?')[0]; // Ignorer les paramètres de requête pour trouver la route

    // --- Étape de nettoyage ---
    // Si une fonction de nettoyage pour la vue précédente existe, on l'exécute.
    if (currentCleanupFunction) {
        currentCleanupFunction();
        currentCleanupFunction = null; // On la réinitialise
    }

    const route = routes[path] || routes['/login']; // Fallback vers /login si la route n'est pas trouvée ou si on est à la racine "/"

    // Protéger les routes non publiques
    const isAuthenticated = checkAuth();

    // 1. Vérifier les droits d'administrateur si nécessaire
    if (route.requiresAdmin && getAuthUserRole() !== 'ADMIN') {
        console.warn(`Accès non autorisé à ${path} pour le rôle '${getAuthUserRole()}'. Redirection vers /user.`);
        // Rediriger vers une page par défaut pour les non-admins
        navigateTo('/user');
        return;
    }


    if (isAuthenticated && !route.public) {
        const cacheBuster = `?v=${new Date().getTime()}`;
        const response = await fetch(`/templates/header.html${cacheBuster}`);
        headerContainer.innerHTML = await response.text();
        const navElement = headerContainer.querySelector('nav');

        initHeader();
        updateHeaderNav(); // Met à jour les liens admin

        /*if (path === "/user") { // Cas spécial pour la vue utilisateur en plein écran
            appContainer.classList.remove('ml-16');
            navElement?.classList.remove('h-screen');
            navElement?.classList.add('opacity-50');
        } else {*/
        appContainer.classList.add('ml-16');
        navElement?.classList.add('h-screen');
        navElement?.classList.remove('opacity-50');
        /*}*/

    } else if (!isAuthenticated) {
        headerContainer.innerHTML = ''; // Vider le header si non authentifié
        appContainer.classList.remove('mr-16'); // Retirer la marge
    }


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
    const cacheBuster = `?v=${new Date().getTime()}`;
    const response = await fetch(`${route.template}${cacheBuster}`);
    if (!response.ok) {
        // Gérer les erreurs de chargement de template
        appContainer.innerHTML = `<p>Erreur: Impossible de charger la vue ${path}.</p>`;
        return;
    }
    appContainer.innerHTML = await response.text();

    // Exécuter le script d'initialisation de la vue
    if (route.init) {
        const urlParams = new URLSearchParams(window.location.search);
        currentCleanupFunction = await route.init(urlParams); // Stocker la fonction de nettoyage retournée
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
