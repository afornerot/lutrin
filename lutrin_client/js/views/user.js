// js/views/user.js
import { startCamera, getCurrentFacingMode } from '../services/camera.js';
import { startApiCheck, stopApiCheck } from '../services/apiStatus.js';
import { processFullCycle } from '../services/processing.js';

// --- Déclaration des variables de la vue ---
let userVideoStream, userAudioPlayback;
let userModeActionButton, userModeStopButton;
let userStatusOverlay, userStatusMessage, userStatusText, userErrorMessage, userErrorText;
let ocrEngineSelect, ttsEngineSelect; // Pour récupérer les moteurs sélectionnés

/**
 * Affiche un message de statut dans l'interface utilisateur.
 */
function showUserStatus(message, isError = false) {
    if (!userStatusOverlay || !userStatusMessage || !userStatusText || !userErrorMessage || !userErrorText) return;

    userStatusOverlay.classList.remove('hidden');
    if (isError) {
        userStatusMessage.classList.add('hidden');
        userErrorMessage.classList.remove('hidden');
        userErrorText.textContent = message;
    } else {
        userStatusMessage.classList.remove('hidden');
        userErrorMessage.classList.add('hidden');
        userStatusText.textContent = message;
    }
}

function hideUserStatus() {
    if (userStatusOverlay) userStatusOverlay.classList.add('hidden');
}

function setUserActionButtonState(disabled) {
    if (userModeActionButton) userModeActionButton.disabled = disabled;
}

async function handleUserActionButtonClick() {
    setUserActionButtonState(true);
    userAudioPlayback.removeAttribute('src');
    hideUserStatus();

    stopApiCheck(); // On suspend la vérification de statut
    try {
        showUserStatus("Traitement en cours...", false);
        const result = await processFullCycle(userVideoStream, ocrEngineSelect.value, ttsEngineSelect.value);

        if (result.audio_url) {
            userAudioPlayback.src = result.audio_url;
            userAudioPlayback.load();
            userAudioPlayback.play();
            // La logique de changement de bouton (play/pause/stop) sera gérée par les écouteurs audio
        } else {
            showUserStatus("Aucun texte détecté ou audio généré.", false);
            setTimeout(hideUserStatus, 3000);
        }

    } catch (error) {
        console.error("Erreur dans le mode utilisateur:", error);
        showUserStatus(`Échec de l'opération : ${error.message || error}`, true);
    } finally {
        setUserActionButtonState(false);
        startApiCheck(); // On réactive la vérification de statut
    }
}

export function initUserView() {
    // 1. Récupérer les éléments du DOM
    userVideoStream = document.getElementById('user-video-stream');
    userAudioPlayback = document.getElementById('user-audio-playback');
    userModeActionButton = document.getElementById('user-mode-action-button');
    userModeStopButton = document.getElementById('user-mode-stop-button');
    userStatusOverlay = document.getElementById('user-status-overlay');
    userStatusMessage = document.getElementById('user-status-message');
    userStatusText = document.getElementById('user-status-text');
    userErrorMessage = document.getElementById('user-error-message');
    userErrorText = document.getElementById('user-error-text');
    ocrEngineSelect = document.getElementById('ocr-engine-select'); // Récupéré du template settings.html
    ttsEngineSelect = document.getElementById('tts-engine-select'); // Récupéré du template settings.html

    const switchCameraButton = document.getElementById('switch-camera-button'); // Bouton de changement de caméra

    // 3. Attacher les écouteurs d'événements
    userModeActionButton?.addEventListener('click', handleUserActionButtonClick);

    switchCameraButton?.addEventListener('click', () => {
        const newFacingMode = getCurrentFacingMode() === 'user' ? 'environment' : 'user';
        startCamera(userVideoStream, newFacingMode).catch(error => {
            showUserStatus(`Erreur caméra: ${error.message}`, true);
        });
    });

    // --- Logique de l'interface audio ---
    const togglePlayPause = () => userAudioPlayback.paused ? userAudioPlayback.play() : userAudioPlayback.pause();

    // Logique du bouton Stop
    const resetButtonToAction = () => {
        if (userModeActionButton) userModeActionButton.innerHTML = '<i class="fas fa-book-open mr-4"></i> Lire la page';
        if (userModeActionButton) userModeActionButton.classList.remove('flex-grow');
        if (userModeActionButton) userModeActionButton.classList.add('w-full');
        if (userModeStopButton) userModeStopButton.classList.add('hidden');
        // Rétablir le comportement initial
        userModeActionButton?.removeEventListener('click', togglePlayPause);
        userModeActionButton?.addEventListener('click', handleUserActionButtonClick);
    };

    const stopAction = () => {
        userAudioPlayback.pause();
        userAudioPlayback.currentTime = 0; // Rembobine l'audio
        resetButtonToAction();
    };
    userModeStopButton?.addEventListener('click', stopAction);

    userAudioPlayback?.addEventListener('play', () => {
        hideUserStatus(); // Masque le message de statut dès que la lecture commence
        // Change le comportement du bouton pour "pause"
        userModeActionButton?.removeEventListener('click', handleUserActionButtonClick);
        userModeActionButton?.addEventListener('click', togglePlayPause);

        if (userModeActionButton) userModeActionButton.classList.add('flex-grow');
        if (userModeActionButton) userModeActionButton.classList.remove('w-full');
        if (userModeStopButton) userModeStopButton.classList.remove('hidden');
        if (userModeActionButton) userModeActionButton.innerHTML = '<i class="fas fa-pause mr-4"></i> Pause';
    });

    userAudioPlayback?.addEventListener('pause', () => {
        // Change le comportement du bouton pour "play"
        if (userAudioPlayback.currentTime > 0 && !userAudioPlayback.ended) {
            if (userModeActionButton) userModeActionButton.innerHTML = '<i class="fas fa-play mr-4"></i> Lecture';
        }
    });

    userAudioPlayback?.addEventListener('ended', () => {
        resetButtonToAction();
    });

    // 4. Démarrer la caméra
    if (userVideoStream) {
        startCamera(userVideoStream).catch(error => showUserStatus(`Erreur caméra: ${error.message}`, true));
    }

    console.log("Vue Utilisateur initialisée.");
}