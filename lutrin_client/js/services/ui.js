// js/services/ui.js
import { logout } from '../auth.js';

/**
 * Initialise les écouteurs d'événements pour la barre de navigation principale.
 * Doit être appelée après que le template du header a été injecté dans le DOM.
 */
export function initHeader() {
    const settingsButton = document.getElementById('main-settings-button');
    const logoutButton = document.getElementById('main-logout-button'); // Correction: Il y avait une div en trop dans le HTML du header

    settingsButton?.addEventListener('click', openSettingsModal);
    logoutButton?.addEventListener('click', logout);

    console.log("Header UI initialisé.");
}

/**
 * Initialise les éléments d'interface partagés à travers différentes vues,
 * comme la modale de configuration.
 */
export function initSharedUI() {
    // Logique pour la modale des moteurs
    const settingsOverlay = document.getElementById('engine-settings-overlay');
    const closeSettingsButton = document.getElementById('close-engine-settings-button');

    // Gère la fermeture de la modale
    closeSettingsButton?.addEventListener('click', () => {
        settingsOverlay?.classList.add('hidden');
    });

    console.log("Shared UI initialisée.");
}

export function openSettingsModal() {
    const settingsOverlay = document.getElementById('engine-settings-overlay');
    settingsOverlay?.classList.remove('hidden');
}