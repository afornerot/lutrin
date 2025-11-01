// js/services/ui.js
import { logout, getAuthUserRole } from '../auth.js';

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
        // S'assurer que les liens sont visibles pour les admins
        adminOnlyLinks.forEach(link => link.style.display = '');
    }
}

/**
 * Initialise les éléments d'interface partagés à travers différentes vues,
 * comme la modale de configuration.
 */
export function initSharedUI() {
    // Logique pour la modale des moteurs
    const settingsOverlay = document.getElementById('engine-settings-overlay');
    const ocrEngineSelect = document.getElementById('ocr-engine-select');
    const ttsEngineSelect = document.getElementById('tts-engine-select');
    const closeSettingsButton = document.getElementById('close-engine-settings-button');

    const OCR_ENGINE_KEY = 'lutrin_ocr_engine';
    const TTS_ENGINE_KEY = 'lutrin_tts_engine';

    // --- Sauvegarde des préférences ---
    ocrEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(OCR_ENGINE_KEY, e.target.value);
        console.log(`Moteur OCR sauvegardé : ${e.target.value}`);
    });

    ttsEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(TTS_ENGINE_KEY, e.target.value);
        console.log(`Moteur TTS sauvegardé : ${e.target.value}`);
    });

    // --- Restauration des préférences au chargement ---
    const savedOcrEngine = localStorage.getItem(OCR_ENGINE_KEY);
    const savedTtsEngine = localStorage.getItem(TTS_ENGINE_KEY);

    if (savedOcrEngine && ocrEngineSelect) ocrEngineSelect.value = savedOcrEngine;
    if (savedTtsEngine && ttsEngineSelect) ttsEngineSelect.value = savedTtsEngine;

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