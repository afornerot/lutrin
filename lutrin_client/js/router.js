// js/router.js
import { initLoginView } from './views/login.js';
import { initRegisterRequestView } from './views/registerrequest.js';
import { initRegisterValidateView } from './views/registervalidate.js';
import { initPasswordRequestView } from './views/passwordrequest.js';
import { initPasswordValidateView } from './views/passwordvalidate.js';

import { initHeader, updateHeaderNav } from './services/ui.js';

import { initCameraView } from './views/camera.js';
import { initEpubsView } from './views/epubs.js';
import { initEpubView } from './views/epub.js';
import { initLibraryView } from './views/library.js';
import { initConsoleView } from './views/console.js';
import { initUsersView } from './views/users.js';
import { initSettingsView } from './views/settings.js';

import { checkAuth, getAuthUserRole } from './auth.js';

const routes = {
    '/': { template: '/templates/home.html', init: null, public: true },
    '/login': { template: '/templates/login.html', init: initLoginView, public: true },
    '/registerrequest': { template: '/templates/registerrequest.html', init: initRegisterRequestView, public: true },
    '/registervalidate': { template: '/templates/registervalidate.html', init: initRegisterValidateView, public: true },
    '/passwordrequest': { template: '/templates/passwordrequest.html', init: initPasswordRequestView, public: true },
    '/passwordvalidate': { template: '/templates/passwordvalidate.html', init: initPasswordValidateView, public: true },

    '/camera': { template: '/templates/camera.html', init: initCameraView },
    '/epubs': { template: '/templates/epubs.html', init: initEpubsView },
    '/epub': { template: '/templates/epub.html', init: initEpubView },
    '/library': { template: '/templates/library.html', init: initLibraryView },
    '/settings': { template: '/templates/settings.html', init: initSettingsView },
    '/console': { template: '/templates/console.html', init: initConsoleView, requiresAdmin: true },
    '/users': { template: '/templates/users.html', init: initUsersView, requiresAdmin: true }

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
        // Rediriger vers la page caméra par défaut pour les non-admins
        navigateTo('/camera');
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
        appContainer.classList.add('with-nav');
        navElement?.classList.add('h-screen');
        navElement?.classList.remove('opacity-50');
        /*}*/

    } else if (!isAuthenticated) {
        headerContainer.innerHTML = ''; // Vider le header si non authentifié
        appContainer.classList.remove('with-nav'); // Retirer la marge
    }


    if (!route.public && !isAuthenticated) {
        history.replaceState(null, '', '/login'); // Redirige sans ajouter à l'historique
        navigate(); // Appel récursif pour charger la nouvelle vue
        return;
    }

    // Si on est authentifié mais qu'on essaie d'aller sur /login, rediriger vers /user
    if (route.public && isAuthenticated) {
        history.replaceState(null, '', '/camera'); // Redirige sans ajouter à l'historique
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
