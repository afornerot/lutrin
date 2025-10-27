// js/views/console.js
import { post, postWithFile } from '../api.js';
import { logout } from '../auth.js';
import { initSharedUI } from '../services/ui.js';
import { initStats, updateStats, clearStats } from '../services/stats.js';
import { startCamera } from '../services/camera.js';
import { startApiCheck, stopApiCheck } from '../services/apiStatus.js';
import { captureImageFromVideo, uploadCapturedImage, runOCR, runTTS, fetchTestTextFile } from '../services/processing.js';

// --- Déclaration des variables de la vue ---
let videoStream, capturedImage, ocrTextResult, audioPlayback;
let captureButton, capturePhotoButtons, captureTextButtons;
let statusMessage, statusText, errorMessage;
let apiStatus;

let ocrEngineSelect, ttsEngineSelect; // Ajout pour les sélecteurs de moteurs

/**
 * Affiche un message de statut dans l'interface de la console.
 */
function showConsoleStatus(message, isError = false, isSuccess = false) {
    if (!statusMessage || !errorMessage || !statusText) return;

    errorMessage.classList.add('hidden');
    statusMessage.classList.remove('hidden', 'bg-yellow-100', 'text-yellow-800', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
    statusText.textContent = message;

    if (isError) {
        statusMessage.classList.add('bg-red-100', 'text-red-800');
    } else if (isSuccess) {
        statusMessage.classList.add('bg-green-100', 'text-green-800');
    } else {
        statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
    }
}

function hideConsoleStatus() {
    if (statusMessage) statusMessage.classList.add('hidden');
    if (errorMessage) errorMessage.classList.add('hidden');
}

function setCaptureButtonsState(disabled) {
    const buttons = document.querySelectorAll('.capture-button');
    buttons.forEach(button => {
        button.disabled = disabled;
    });
}

async function startCaptureAndOCR() {
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats();
    stopApiCheck(); // On suspend la vérification de statut pendant l'opération

    let captureDuration = null, uploadDuration = null, ocrDuration = null, ttsDuration = null;

    try {
        showConsoleStatus("1/3 - Capture et envoi de l'image...", false);
        const captureStartTime = performance.now();
        const { blob, imageDataUrl } = await captureImageFromVideo(videoStream);
        const captureEndTime = performance.now();
        captureDuration = captureEndTime - captureStartTime;
        if (capturedImage) capturedImage.src = imageDataUrl;

        const uploadStartTime = performance.now();
        const captureData = await uploadCapturedImage(blob);
        const uploadEndTime = performance.now();
        uploadDuration = uploadEndTime - uploadStartTime;

        showConsoleStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        const ocrStartTime = performance.now();
        const ocrData = await runOCR(captureData.image_filename, ocrEngineSelect.value);
        const ocrEndTime = performance.now();
        ocrDuration = ocrEndTime - ocrStartTime;
        if (ocrTextResult) ocrTextResult.value = ocrData.text;

        showConsoleStatus("3/3 - Génération de l'audio (TTS)...", false);
        if (ocrData.text && ocrData.text.trim() !== "") {
            const ttsStartTime = performance.now();
            const ttsData = await runTTS(ocrData.text, ttsEngineSelect.value);
            const ttsEndTime = performance.now();
            ttsDuration = ttsEndTime - ttsStartTime;
            audioPlayback.src = ttsData.audio_url;
            audioPlayback.load();
            audioPlayback.play();
        } else {
            showConsoleStatus("Aucun texte détecté, pas de génération audio.", false, true);
        }

        showConsoleStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideConsoleStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showConsoleStatus(`Échec de l'opération : ${error.message || error}`, true);
    } finally {
        updateStats(captureDuration !== null ? captureDuration + (uploadDuration || 0) : null, ocrDuration, ttsDuration); // Combiner capture et upload pour la stat
        setCaptureButtonsState(false);
        startApiCheck(); // On réactive la vérification de statut
    }
}

async function startOCRFromFile(filename) {
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats();
    stopApiCheck(); // On suspend la vérification de statut

    let ocrDuration = null, ttsDuration = null;

    try {
        showConsoleStatus(`1/2 - Reconnaissance du texte (OCR) depuis ${filename}...`, false);
        // Simuler le chargement visuel de l'image de test
        if (capturedImage) capturedImage.src = `file/${filename}?t=${new Date().getTime()}`;
        await new Promise(resolve => setTimeout(resolve, 200)); // Petit délai pour l'affichage

        const ocrStartTime = performance.now();
        const ocrData = await runOCR(filename, ocrEngineSelect.value);
        const ocrEndTime = performance.now();
        ocrDuration = ocrEndTime - ocrStartTime;
        if (ocrTextResult) ocrTextResult.value = ocrData.text;

        showConsoleStatus("2/2 - Génération de l'audio (TTS)...", false);
        if (ocrData.text && ocrData.text.trim() !== "") {
            const ttsStartTime = performance.now();
            const ttsData = await runTTS(ocrData.text, ttsEngineSelect.value);
            const ttsEndTime = performance.now();
            ttsDuration = ttsEndTime - ttsStartTime;
            audioPlayback.src = ttsData.audio_url;
            audioPlayback.load();
            audioPlayback.play();
        } else {
            showConsoleStatus("Aucun texte détecté, pas de génération audio.", false, true);
        }

        showConsoleStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideConsoleStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showConsoleStatus(`Échec de l'opération : ${error.message || error}`, true);
    } finally {
        updateStats(null, ocrDuration, ttsDuration);
        setCaptureButtonsState(false);
        startApiCheck(); // On réactive la vérification de statut
    }
}

async function startTTSFromFile(filename) {
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats();
    stopApiCheck(); // On suspend la vérification de statut

    let textFetchDuration = null, ttsDuration = null;

    try {
        showConsoleStatus(`1/2 - Récupération du texte depuis ${filename}...`, false);
        const textFetchStartTime = performance.now();
        const textContent = await fetchTestTextFile(filename);
        const textFetchEndTime = performance.now();
        textFetchDuration = textFetchEndTime - textFetchStartTime;
        if (ocrTextResult) ocrTextResult.value = textContent;

        showConsoleStatus("2/2 - Génération de l'audio (TTS)...", false);
        const ttsStartTime = performance.now();
        const ttsData = await runTTS(textContent, ttsEngineSelect.value);
        const ttsEndTime = performance.now();
        ttsDuration = ttsEndTime - ttsStartTime;
        audioPlayback.src = ttsData.audio_url;
        audioPlayback.load();
        audioPlayback.play();

        showConsoleStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideConsoleStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showConsoleStatus(`Échec de l'opération : ${error.message || error}`, true);
    } finally {
        updateStats(textFetchDuration, null, ttsDuration);
        setCaptureButtonsState(false);
        startApiCheck(); // On réactive la vérification de statut
    }
}

/**
 * Initialise la vue console après le chargement de son template.
 */
export function initConsoleView() {
    // 1. Récupérer les éléments du DOM spécifiques à la console
    videoStream = document.getElementById('video-stream');
    capturedImage = document.getElementById('captured-image');
    ocrTextResult = document.getElementById('ocr-text-result');
    audioPlayback = document.getElementById('audio-playback');
    captureButton = document.getElementById('capture-button');
    capturePhotoButtons = document.querySelectorAll('[id^="capture-photo"]');
    captureTextButtons = document.querySelectorAll('[id^="capture-text"]');
    statusMessage = document.getElementById('status-message');
    errorMessage = document.getElementById('error-message');
    if (statusMessage) statusText = statusMessage.querySelector('span');
    ocrEngineSelect = document.getElementById('ocr-engine-select');
    ttsEngineSelect = document.getElementById('tts-engine-select');
    apiStatus = document.getElementById('api-status');

    // 2. Initialiser les modules de service
    initSharedUI();
    initStats();

    // 3. Attacher les écouteurs d'événements
    document.getElementById('logout-button')?.addEventListener('click', logout);

    captureButton?.addEventListener('click', startCaptureAndOCR);
    capturePhotoButtons.forEach(button => {
        const file = button.dataset.file;
        if (file) button.addEventListener('click', () => startOCRFromFile(file));
    });
    captureTextButtons.forEach(button => {
        const file = button.dataset.file;
        if (file) button.addEventListener('click', () => startTTSFromFile(file));
    });

    // 4. Gérer les mises à jour de l'état de l'API
    document.addEventListener('api-status-change', (event) => {
        if (apiStatus) {
            if (event.detail.online) {
                apiStatus.textContent = `API: EN LIGNE`;
                apiStatus.classList.remove('text-red-500');
                apiStatus.classList.add('text-green-500');
            } else {
                apiStatus.textContent = `API: HORS LIGNE`;
                apiStatus.classList.remove('text-green-500');
                apiStatus.classList.add('text-red-500');
            }
        }
    });

    console.log("Vue Console initialisée.");

    // 5. Démarrer la caméra
    if (videoStream) {
        startCamera(videoStream).catch(error => {
            showConsoleStatus(`Erreur caméra: ${error.message}`, true);
        });
    }
}