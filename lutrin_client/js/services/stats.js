// js/services/stats.js

// Éléments du DOM gérés par ce module
let statCaptureTime;
let statOcrTime;
let statTtsTime;

/**
 * Met à jour l'affichage des statistiques de traitement.
 * @param {number|null} captureTime - Temps de capture en ms.
 * @param {number|null} ocrTime - Temps d'OCR en ms.
 * @param {number|null} ttsTime - Temps de TTS en ms.
 */
export function updateStats(captureTime, ocrTime, ttsTime) {
    if (statCaptureTime) statCaptureTime.textContent = captureTime !== null ? `${(captureTime / 1000).toFixed(2)}` : 'N/A';
    if (statOcrTime) statOcrTime.textContent = ocrTime !== null ? `${(ocrTime / 1000).toFixed(2)}` : 'N/A';
    if (statTtsTime) statTtsTime.textContent = ttsTime !== null ? `${(ttsTime / 1000).toFixed(2)}` : 'N/A';
}

/**
 * Réinitialise l'affichage des statistiques.
 */
export function clearStats() {
    updateStats(null, null, null);
}

/**
 * Initialise le module de statistiques en récupérant les éléments du DOM.
 */
export function initStats() {
    statCaptureTime = document.getElementById('stat-capture-time');
    statOcrTime = document.getElementById('stat-ocr-time');
    statTtsTime = document.getElementById('stat-tts-time');
}