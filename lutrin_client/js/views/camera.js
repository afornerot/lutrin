// js/views/camera.js
import { startCamera, getCurrentFacingMode } from '../services/camera.js';
import { startApiCheck, stopApiCheck } from '../services/apiStatus.js';
import { processFullCycle } from '../services/processing.js';

// --- Déclaration des variables de la vue ---
let cameraVideoStream, cameraAudioPlayback;
let cameraModeActionButton, cameraModeStopButton;
let cameraStatusOverlay, cameraStatusMessage, cameraStatusText, cameraErrorMessage, cameraErrorText;
let ocrEngineSelect, ttsEngineSelect; // Pour récupérer les moteurs sélectionnés

/**
 * Affiche un message de statut dans l'interface utilisateur.
 */
function showCameraStatus(message, isError = false) {
    if (!cameraStatusOverlay || !cameraStatusMessage || !cameraStatusText || !cameraErrorMessage || !cameraErrorText) return;

    cameraStatusOverlay.classList.remove('hidden');
    if (isError) {
        cameraStatusMessage.classList.add('hidden');
        cameraErrorMessage.classList.remove('hidden');
        cameraErrorText.textContent = message;
    } else {
        cameraStatusMessage.classList.remove('hidden');
        cameraErrorMessage.classList.add('hidden');
        cameraStatusText.textContent = message;
    }
}

function hideCameraStatus() {
    if (cameraStatusOverlay) cameraStatusOverlay.classList.add('hidden');
}

function setCameraActionButtonState(disabled) {
    if (cameraModeActionButton) cameraModeActionButton.disabled = disabled;
}

async function handleCameraActionButtonClick() {
    setCameraActionButtonState(true);
    cameraAudioPlayback.removeAttribute('src');
    hideCameraStatus();

    stopApiCheck(); // On suspend la vérification de statut
    try {
        showCameraStatus("Traitement en cours...", false);
        const result = await processFullCycle(cameraVideoStream, ocrEngineSelect.value, ttsEngineSelect.value);

        if (result.audio_url) {
            cameraAudioPlayback.src = result.audio_url;
            cameraAudioPlayback.load();
            cameraAudioPlayback.play();
            // La logique de changement de bouton (play/pause/stop) sera gérée par les écouteurs audio
        } else {
            showCameraStatus("Aucun texte détecté ou audio généré.", false);
            setTimeout(hideCameraStatus, 3000);
        }

    } catch (error) {
        console.error("Erreur dans le mode caméra:", error);
        showCameraStatus(`Échec de l'opération : ${error.message || error}`, true);
    } finally {
        setCameraActionButtonState(false);
        startApiCheck(); // On réactive la vérification de statut
    }
}

export function initCameraView() {
    // 1. Récupérer les éléments du DOM
    cameraVideoStream = document.getElementById('camera-video-stream');
    cameraAudioPlayback = document.getElementById('camera-audio-playback');
    cameraModeActionButton = document.getElementById('camera-mode-action-button');
    cameraModeStopButton = document.getElementById('camera-mode-stop-button');
    cameraStatusOverlay = document.getElementById('camera-status-overlay');
    cameraStatusMessage = document.getElementById('camera-status-message');
    cameraStatusText = document.getElementById('camera-status-text');
    cameraErrorMessage = document.getElementById('camera-error-message');
    cameraErrorText = document.getElementById('camera-error-text');
    ocrEngineSelect = document.getElementById('ocr-engine-select'); // Récupéré du template settings.html
    ttsEngineSelect = document.getElementById('tts-engine-select'); // Récupéré du template settings.html

    const switchCameraButton = document.getElementById('switch-camera-button'); // Bouton de changement de caméra

    // 3. Attacher les écouteurs d'événements
    cameraModeActionButton?.addEventListener('click', handleCameraActionButtonClick);

    switchCameraButton?.addEventListener('click', () => {
        const newFacingMode = getCurrentFacingMode() === 'user' ? 'environment' : 'user';
        startCamera(cameraVideoStream, newFacingMode).catch(error => {
            showCameraStatus(`Erreur caméra: ${error.message}`, true);
        });
    });

    // --- Logique de l'interface audio ---
    const togglePlayPause = () => cameraAudioPlayback.paused ? cameraAudioPlayback.play() : cameraAudioPlayback.pause();

    const resetButtonToAction = () => {
        if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-book-open mr-4"></i> Lire la page';
        if (cameraModeActionButton) cameraModeActionButton.classList.remove('flex-grow');
        if (cameraModeActionButton) cameraModeActionButton.classList.add('w-full');
        if (cameraModeStopButton) cameraModeStopButton.classList.add('hidden');
        cameraModeActionButton?.removeEventListener('click', togglePlayPause);
        cameraModeActionButton?.addEventListener('click', handleCameraActionButtonClick);
    };

    const stopAction = () => {
        cameraAudioPlayback.pause();
        cameraAudioPlayback.currentTime = 0;
        resetButtonToAction();
    };
    cameraModeStopButton?.addEventListener('click', stopAction);

    cameraAudioPlayback?.addEventListener('play', () => {
        hideCameraStatus();
        cameraModeActionButton?.removeEventListener('click', handleCameraActionButtonClick);
        cameraModeActionButton?.addEventListener('click', togglePlayPause);
        if (cameraModeActionButton) cameraModeActionButton.classList.add('flex-grow');
        if (cameraModeActionButton) cameraModeActionButton.classList.remove('w-full');
        if (cameraModeStopButton) cameraModeStopButton.classList.remove('hidden');
        if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-pause mr-4"></i> Pause';
    });

    cameraAudioPlayback?.addEventListener('pause', () => {
        if (cameraAudioPlayback.currentTime > 0 && !cameraAudioPlayback.ended) {
            if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-play mr-4"></i> Lecture';
        }
    });

    cameraAudioPlayback?.addEventListener('ended', () => {
        resetButtonToAction();
    });

    // 4. Démarrer la caméra
    if (cameraVideoStream) {
        startCamera(cameraVideoStream).catch(error => showCameraStatus(`Erreur caméra: ${error.message}`, true));
    }

    console.log("Vue Caméra initialisée.");
}