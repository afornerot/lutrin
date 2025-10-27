// js/services/ui.js

/**
 * Gère l'ouverture et la fermeture de l'overlay des réglages.
 */
function setupEngineSettings() {
    const engineSettingsOverlay = document.getElementById('engine-settings-overlay');
    const closeButton = document.getElementById('close-engine-settings-button');
    const openButtons = document.querySelectorAll('[id^="open-engine-settings-"]'); // Selects all buttons starting with the ID

    if (!engineSettingsOverlay || !closeButton || openButtons.length === 0) return;

    const open = () => engineSettingsOverlay.classList.remove('hidden');
    const close = () => engineSettingsOverlay.classList.add('hidden');

    openButtons.forEach(button => button.addEventListener('click', open));
    closeButton.addEventListener('click', close);
    engineSettingsOverlay.addEventListener('click', (e) => {
        if (e.target === engineSettingsOverlay) close();
    });
}

/**
 * Gère le changement de mode (console/utilisateur).
 */
function setupModeToggle() {
    const modeToggles = document.querySelectorAll('#mode-toggle'); // Il peut y en avoir un dans chaque vue
    if (modeToggles.length === 0) return;

    const isConsole = window.location.hash === '#/console';

    modeToggles.forEach(toggle => {
        toggle.checked = isConsole;
        toggle.addEventListener('change', (e) => {
            window.location.hash = e.target.checked ? '#/console' : '#/user';
        });
    });
}

/**
 * Gère la persistance des choix de moteurs OCR et TTS.
 */
function setupEnginePersistence() {
    const ocrSelect = document.getElementById('ocr-engine-select');
    const ttsSelect = document.getElementById('tts-engine-select');

    if (ocrSelect) {
        ocrSelect.value = localStorage.getItem('lutrin-ocr-engine') || 'groq';
        ocrSelect.addEventListener('change', (e) => localStorage.setItem('lutrin-ocr-engine', e.target.value));
    }
    if (ttsSelect) {
        ttsSelect.value = localStorage.getItem('lutrin-tts-engine') || 'piper';
        ttsSelect.addEventListener('change', (e) => localStorage.setItem('lutrin-tts-engine', e.target.value));
    }
}

/**
 * Initialise tous les composants d'UI partagés.
 */
export function initSharedUI() {
    setupEngineSettings();
    setupModeToggle();
    setupEnginePersistence();
}