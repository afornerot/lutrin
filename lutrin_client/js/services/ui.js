// js/services/ui.js
import { logout, getAuthUserRole } from '../auth.js';

/**
 * Initialise les écouteurs d'événements pour la barre de navigation principale.
 * Doit être appelée après que le template du header a été injecté dans le DOM.
 */
export function initHeader() {
    const logoutButton = document.getElementById('main-logout-button');
    logoutButton?.addEventListener('click', logout);

    console.log("Header UI initialisé.");
}

/**
 * Met à jour la visibilité des liens de navigation en fonction du rôle de l'utilisateur.
 * Cache les éléments avec l'attribut `data-admin-only="true"` si l'utilisateur n'est pas ADMIN.
 */
export function updateHeaderNav() {
    const userRole = getAuthUserRole();
    const adminOnlyLinks = document.querySelectorAll('[data-admin-only="true"]');

    if (userRole !== 'ADMIN') {
        adminOnlyLinks.forEach(link => {
            link.style.display = 'none';
        });
    } else {
        adminOnlyLinks.forEach(link => link.style.display = '');
    }
}
