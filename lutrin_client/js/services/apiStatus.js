// js/services/apiStatus.js
import { get } from '../api.js';

let isApiOnline = true;
let apiCheckInterval;

// Éléments du DOM gérés par ce module
let offlineOverlay;
let refreshButton;

/**
 * Vérifie l'état de l'API et met à jour l'interface.
 */
async function checkStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await get('/status', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!isApiOnline) {
            // L'API vient de revenir en ligne, on recharge pour réinitialiser l'état.
            location.reload();
        }
        isApiOnline = true;
        if (offlineOverlay) offlineOverlay.classList.add('hidden');

        // Émettre un événement pour que d'autres parties de l'app puissent réagir
        document.dispatchEvent(new CustomEvent('api-status-change', { detail: { online: true } }));

    } catch (error) {
        if (isApiOnline) {
            // L'API vient de passer hors ligne
            if (offlineOverlay) offlineOverlay.classList.remove('hidden');
        }
        isApiOnline = false;
        document.dispatchEvent(new CustomEvent('api-status-change', { detail: { online: false } }));
    }
}

/**
 * Démarre la vérification périodique de l'API.
 */
export function startApiCheck() {
    if (!apiCheckInterval) {
        checkStatus(); // Vérification immédiate au démarrage
        apiCheckInterval = setInterval(checkStatus, 30000); // Puis toutes les 30 secondes
    }
}

/**
 * Arrête la vérification périodique de l'API.
 */
export function stopApiCheck() {
    clearInterval(apiCheckInterval);
    apiCheckInterval = null;
}

export function initApiStatus() {
    offlineOverlay = document.getElementById('offline-overlay');
    refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => location.reload());
    }
    startApiCheck();
}