// --- Éléments du DOM (déclarés ici, assignés dans initializeApp pour garantir DOM readiness) ---
let videoStream;
let capturedImage;
let ocrTextResult;
let audioPlayback;
let captureButton; // NodeList, not a single element
let ocrEngineSelect;
let ttsEngineSelect;

// --- Éléments de connexion ---
let loginOverlay;
let loginForm;
let rememberMeCheckbox;
let loginButton;
let loginError;
let mainContent;
let offlineOverlay;
let refreshButton;
let logoutButton;
let userLogoutButton;
let modeToggle;
let consoleModeContent;
let userModeContent;

// Éléments des réglages moteurs
let engineSettingsOverlay;
let closeEngineSettingsButton;
let openEngineSettingsConsoleButton;
let openEngineSettingsUserButton;


let isApiOnline = true; // Pour suivre l'état de l'API
let apiKey = null; // Variable globale pour stocker la clé d'API

// Statut et messages
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');
let apiStatus;
let statusText;

// Éléments pour les statistiques (déclarés ici, assignés dans initializeApp)
let statCaptureTime;
let statOcrTime;
let statTtsTime;

// Éléments du mode utilisateur
let userVideoStream;
let userOcrResult;
let userAudioPlayback;
let userModeStopButton;
let userModeActionButton;
let userStatusOverlay;
let userStatusMessage;
let userStatusText;
let userErrorMessage;
let userErrorText;
let switchCameraButton;


// Fonctions Utilitaires ---
/**
 * Affiche un message de statut, gérant les états d'erreur et de succès.
 * @param {string} message - Le message à afficher.
 * @param {boolean} isError - True si le message est une erreur.
 * @param {boolean} isSuccess - True si le message est un succès.
 */
function showStatus(message, isError = false, isSuccess = false) {
    // Mode Console
    errorMessage.classList.add('hidden');
    statusMessage.classList.remove('hidden', 'bg-yellow-100', 'text-yellow-800', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
    if (statusText) statusText.textContent = message;

    if (isError) statusMessage.classList.add('bg-red-100', 'text-red-800');
    else if (isSuccess) statusMessage.classList.add('bg-green-100', 'text-green-800');
    else statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');

    // Mode Utilisateur
    userStatusOverlay.classList.remove('hidden');
    userErrorMessage.classList.add('hidden');
    userStatusMessage.classList.remove('hidden');
    userStatusText.textContent = message;

    // Gestion des couleurs pour le mode utilisateur (pas de changement de fond, juste le message)
    if (isError) {
        userStatusMessage.classList.add('hidden');
        userErrorMessage.classList.remove('hidden');
        userErrorText.textContent = message;
    } else {
        // Pas de couleur spécifique pour succès/en cours pour l'instant, le loader suffit
    }
}

function showError(message) {
    // Mode Console
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    statusMessage.classList.add('hidden');

    // Mode Utilisateur
    userStatusOverlay.classList.remove('hidden');
    userStatusMessage.classList.add('hidden');
    userErrorMessage.classList.remove('hidden');
    userErrorText.textContent = message;
}

function hideStatus() {
    // Mode Console
    statusMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');

    // Mode Utilisateur
    userStatusOverlay.classList.add('hidden');
    userStatusMessage.classList.remove('hidden');
    userErrorMessage.classList.add('hidden');
}

function setCaptureButtonsState(disabled) {
    if (captureButton) for (const button of captureButton) { // Check if captureButton is available
        button.disabled = disabled;
    }
}

function updateStats(captureTime, ocrTime, ttsTime) {
    statCaptureTime.textContent = captureTime !== null ? `${(captureTime / 1000).toFixed(2)}` : 'N/A';
    statOcrTime.textContent = ocrTime !== null ? `${(ocrTime / 1000).toFixed(2)}` : 'N/A';
    statTtsTime.textContent = ttsTime !== null ? `${(ttsTime / 1000).toFixed(2)}` : 'N/A';
}

function clearStats() {
    statCaptureTime.textContent = 'N/A';
    statOcrTime.textContent = 'N/A';
    statTtsTime.textContent = 'N/A';
}

async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (response.ok) {
            // L'API est EN LIGNE
            if (!isApiOnline) {
                // Si l'API était hors ligne avant, on recharge la page pour tout réinitialiser
                location.reload();
            }
            isApiOnline = true;
            const data = await response.json();
            apiStatus.textContent = `API: EN LIGNE`;
            if (apiStatus) apiStatus.classList.remove('text-red-500');
            if (apiStatus) apiStatus.classList.add('text-green-500');
        } else {
            // L'API répond mais avec une erreur
            throw new Error(`Erreur HTTP ${response.status}`);
        }
    } catch (error) {
        // L'API est HORS LIGNE (erreur réseau)
        if (isApiOnline) {
            // C'est la première fois qu'on détecte la déconnexion
            if (mainContent) mainContent.classList.add('hidden');
            if (offlineOverlay) offlineOverlay.classList.remove('hidden');
        }
        isApiOnline = false;
    }
}

function getApiHeaders() {
    if (!apiKey) {
        throw new Error("Utilisateur non authentifié. La clé d'API est manquante.");
    }
    return { 'X-API-Key': apiKey };
}

let currentFacingMode = 'environment'; // 'environment' pour la caméra arrière, 'user' pour l'avant

async function startLocalCamera(facingMode) {
    // Arrêter le flux précédent s'il existe
    if (videoStream && videoStream.srcObject) {
        videoStream.srcObject.getTracks().forEach(track => track.stop());
    }
    if (userVideoStream && userVideoStream.srcObject) {
        userVideoStream.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 4096 },
                height: { ideal: 2160 }
            }
        });
        if (videoStream) videoStream.srcObject = stream;
        if (userVideoStream) userVideoStream.srcObject = stream;

        // Vérifier si le navigateur a pu obtenir le mode souhaité
        const videoTrack = stream.getVideoTracks()[0];
        currentFacingMode = videoTrack.getSettings().facingMode || facingMode;
    } catch (error) {
        console.error("Erreur d'accès à la caméra:", error);
        showError("Impossible d'accéder à la caméra. Vérifiez les permissions dans votre navigateur.");
    }
}

async function startCaptureAndOCR() {
    // 1. Désactiver le bouton et montrer le statut
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats(); // Réinitialiser les stats

    let uploadStartTime, uploadEndTime, ocrStartTime, ocrEndTime, ttsStartTime, ttsEndTime;
    let uploadDuration = null, ocrDuration = null, ttsDuration = null;

    try {
        // --- Étape 1: Capture et Upload de l'image ---
        showStatus("1/3 - Capture et envoi de l'image...", false);
        uploadStartTime = performance.now();

        // Sélectionne le flux vidéo actif en fonction du mode UI
        const activeVideoStream = modeToggle.checked ? videoStream : userVideoStream;

        const canvas = document.createElement('canvas');
        canvas.width = activeVideoStream.videoWidth;
        canvas.height = activeVideoStream.videoHeight;
        canvas.getContext('2d').drawImage(activeVideoStream, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');

        if (capturedImage) capturedImage.src = imageDataUrl; // Check if capturedImage is available

        const blob = await (await fetch(imageDataUrl)).blob();
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        const captureResponse = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: { ...getApiHeaders() },
            body: formData,
        });
        if (!captureResponse.ok) {
            const errorText = await captureResponse.text(); // Lire la réponse comme du texte
            throw new Error(`Étape 1 (Capture) a échoué avec le statut ${captureResponse.status}: ${errorText}`);
        }
        const captureData = await captureResponse.json();
        uploadEndTime = performance.now();
        uploadDuration = uploadEndTime - uploadStartTime;

        // --- Étape 2: Lancement de l'OCR ---
        showStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        ocrStartTime = performance.now();
        const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(), 'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_filename: captureData.image_filename,
                ocr_engine: ocrEngineSelect.value
            })
        });
        if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text();
            throw new Error(`Étape 2 (OCR) a échoué avec le statut ${ocrResponse.status}: ${errorText}`);
        }
        const ocrData = await ocrResponse.json();
        ocrEndTime = performance.now();
        ocrDuration = ocrEndTime - ocrStartTime;
        if (ocrTextResult) ocrTextResult.value = ocrData.text;
        if (userOcrResult) userOcrResult.textContent = ocrData.text;

        // --- Étape 3: Génération du TTS ---
        showStatus("3/3 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(), 'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: ocrData.text,
                tts_engine: ttsEngineSelect.value
            })
        });
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`Étape 3 (TTS) a échoué avec le statut ${ttsResponse.status}: ${errorText}`);
        }
        const ttsData = await ttsResponse.json();
        ttsEndTime = performance.now();
        ttsDuration = ttsEndTime - ttsStartTime;

        // Jouer l'audio sur le lecteur approprié en fonction du mode
        const activeAudioPlayer = modeToggle.checked ? audioPlayback : userAudioPlayback;
        activeAudioPlayer.src = ttsData.audio_url;
        activeAudioPlayer.load();
        activeAudioPlayer.play();


        // --- Fin de l'opération ---
        showStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showError(`Échec de l'opération : ${error.message || error}`);
    } finally {
        // Mettre à jour les statistiques
        updateStats(uploadDuration, ocrDuration, ttsDuration);
        // Rétablir le bouton
        setCaptureButtonsState(false);
    }
}

async function startOCR(fichier) {
    // 1. Désactiver les bouton et montrer le statut
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats(); // Réinitialiser les stats

    let captureStartTime, captureEndTime, ocrStartTime, ocrEndTime, ttsStartTime, ttsEndTime;
    let captureDuration = null, ocrDuration = null, ttsDuration = null;

    try {
        // --- Étape 1: Chargement de l'image (simulé comme capture) ---
        showStatus("1/3 - Chargement de l'image de test...", false);
        captureStartTime = performance.now();
        capturedImage.src = "file/" + fichier + "?t=" + new Date().getTime();
        // Simuler un petit délai pour le chargement visuel
        if (capturedImage) await new Promise(resolve => setTimeout(resolve, 200)); // Check if capturedImage is available
        captureEndTime = performance.now();
        captureDuration = captureEndTime - captureStartTime;

        // --- Étape 2: Lancement de l'OCR ---
        showStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        ocrStartTime = performance.now();
        const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(), 'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_filename: fichier,
                ocr_engine: ocrEngineSelect.value
            })
        });
        if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text();
            throw new Error(`Étape 2 (OCR) a échoué avec le statut ${ocrResponse.status}: ${errorText}`);
        }
        const ocrData = await ocrResponse.json();
        ocrEndTime = performance.now();
        ocrDuration = ocrEndTime - ocrStartTime;
        if (ocrTextResult) ocrTextResult.value = ocrData.text;
        if (userOcrResult) userOcrResult.textContent = ocrData.text;

        // --- Étape 3: Génération du TTS ---
        showStatus("3/3 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(), 'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: ocrData.text,
                tts_engine: ttsEngineSelect.value
            })
        });
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`Étape 3 (TTS) a échoué avec le statut ${ttsResponse.status}: ${errorText}`);
        }
        const ttsData = await ttsResponse.json();
        ttsEndTime = performance.now();
        ttsDuration = ttsEndTime - ttsStartTime;

        const activeAudioPlayer = modeToggle.checked ? audioPlayback : userAudioPlayback;
        activeAudioPlayer.src = ttsData.audio_url;
        activeAudioPlayer.load();
        activeAudioPlayer.play();

        // --- Fin de l'opération ---
        showStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideStatus, 3000);


    } catch (error) {
        console.error("Erreur complète:", error);
        showError(`Échec de l'opération : ${error.message || error}`);
    } finally {
        // Mettre à jour les statistiques
        updateStats(captureDuration, ocrDuration, ttsDuration);
        // Rétablir le bouton
        setCaptureButtonsState(false);
    }
}

// Fonction TTS sur fichier spécifique
async function startTTS(fichier) {
    // 1. Désactiver les boutons et montrer le statut
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats(); // Réinitialiser les stats

    let textFetchStartTime, textFetchEndTime, ttsStartTime, ttsEndTime;
    let textFetchDuration = null, ttsDuration = null;

    try {
        // --- Étape 1: Récupération du contenu du fichier texte ---
        showStatus("1/2 - Récupération du texte...", false);
        textFetchStartTime = performance.now();
        const textFileUrl = `file/${fichier}`;
        const textResponse = await fetch(textFileUrl);
        if (!textResponse.ok) {
            throw new Error(`Étape 1 (Récupération texte) a échoué avec le statut ${textResponse.status}`);
        }
        const textContent = await textResponse.text();
        textFetchEndTime = performance.now();
        textFetchDuration = textFetchEndTime - textFetchStartTime;
        if (ocrTextResult) ocrTextResult.value = textContent; // Afficher le texte dans la textarea

        // --- Étape 2: Génération du TTS ---
        console.log(ttsEngineSelect.value);
        showStatus("2/2 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(), 'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: textContent,
                tts_engine: ttsEngineSelect.value
            }) // Envoyer le contenu récupéré
        });
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`Étape 2 (TTS) a échoué avec le statut ${ttsResponse.status}: ${errorText}`);
        }
        const ttsData = await ttsResponse.json();
        ttsEndTime = performance.now();
        ttsDuration = ttsEndTime - ttsStartTime;

        const activeAudioPlayer = modeToggle.checked ? audioPlayback : userAudioPlayback;
        activeAudioPlayer.src = ttsData.audio_url;
        activeAudioPlayer.load();

        // --- Fin de l'opération ---
        showStatus("Opération terminée avec succès !", false, true);
        setTimeout(hideStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showError(`Échec de l'opération : ${error.message || error}`);
    } finally {
        // Mettre à jour les statistiques

        updateStats(textFetchDuration, null, ttsDuration); // OCR est null pour cette fonction

        // Rétablir le bouton
        setCaptureButtonsState(false);

        // Lire la capture du son
        const activeAudioPlayer = modeToggle.checked ? audioPlayback : userAudioPlayback;
        if (activeAudioPlayer) activeAudioPlayer.play();

    }
}

async function noOCR() {
    const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
            ...getApiHeaders(), 'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: "Aucun texte détecté",
            tts_engine: ttsEngineSelect.value
        }) // Envoyer le contenu récupéré
    });
    if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        throw new Error(`Étape 2 (TTS) a échoué avec le statut ${ttsResponse.status}: ${errorText}`);
    }
}
// Initialisation

function checkSession() {
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;
    let sessionData = null;

    // Essayer de récupérer la session depuis localStorage (si "Rester connecté" était coché)
    const localSession = localStorage.getItem('lutrin-session');
    if (localSession) {
        sessionData = JSON.parse(localSession);
    } else {
        // Sinon, essayer sessionStorage (session normale)
        const sessionSession = sessionStorage.getItem('lutrin-session');
        if (sessionSession) {
            sessionData = JSON.parse(sessionSession);
        }
    }

    if (sessionData && sessionData.apiKey && sessionData.loginTime) {
        // Vérifier si la session a expiré (plus d'une heure)
        if (now - sessionData.loginTime < oneHour) {
            apiKey = sessionData.apiKey;
            loginOverlay.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
            if (initializeApp) initializeApp(); // Ensure initializeApp is defined and callable
            return true; // Session valide trouvée
        } else {
            // Nettoyer la session expirée
            localStorage.removeItem('lutrin-session');
            sessionStorage.removeItem('lutrin-session');
        }
    }
    return false; // Aucune session valide
}

function initializeApp() {
    // --- Logique du bouton d'action en mode utilisateur ---
    const userActionButtonContent = userModeActionButton.innerHTML; // Sauvegarde du contenu initial

    const togglePlayPause = () => {
        if (userAudioPlayback.paused) {
            userAudioPlayback.play();
        } else {
            userAudioPlayback.pause();
        }
    };

    const resetButtonToAction = () => {
        userModeActionButton.innerHTML = userActionButtonContent;
        userModeActionButton.classList.remove('flex-grow');
        userModeActionButton.classList.add('w-full');
        userModeStopButton.classList.add('hidden');
        userModeActionButton.onclick = startCaptureAndOCR;
    };

    // --- Logique du bouton Stop ---
    const stopAction = () => {
        userAudioPlayback.pause();
        userAudioPlayback.currentTime = 0; // Rembobine l'audio
        resetButtonToAction();
    };
    userModeStopButton.addEventListener('click', stopAction);

    userAudioPlayback.addEventListener('play', () => {
        hideStatus(); // Masque le message de statut dès que la lecture commence
        userModeActionButton.onclick = togglePlayPause;
        userModeActionButton.classList.add('flex-grow');
        userModeActionButton.classList.remove('w-full');
        userModeStopButton.classList.remove('hidden');
        userModeActionButton.innerHTML = '<i class="fas fa-pause mr-4"></i> Pause';
    });

    userAudioPlayback.addEventListener('pause', () => {
        // Ne rien faire si l'audio est terminé (currentTime est à 0 ou proche de la fin)
        // L'événement 'ended' s'en chargera.
        if (userAudioPlayback.currentTime > 0 && !userAudioPlayback.ended) {
            userModeActionButton.innerHTML = '<i class="fas fa-play mr-4"></i> Lecture';
        }
    });

    userAudioPlayback.addEventListener('ended', () => {
        resetButtonToAction();
    });

    // Initialiser l'état du bouton d'action en mode utilisateur
    resetButtonToAction();

    // --- Logique du bouton de changement de caméra ---
    switchCameraButton.addEventListener('click', () => {
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        startLocalCamera(newFacingMode);
    });

    // --- Logique de rafraîchissement manuel ---
    refreshButton.addEventListener('click', () => {
        location.reload();
    });

    // --- Logique de déconnexion ---
    const logoutAction = () => {
        // Nettoyer la clé d'API et les stockages de session
        apiKey = null;
        localStorage.removeItem('lutrin-session');
        sessionStorage.removeItem('lutrin-session');
        // Recharger la page pour revenir à l'écran de connexion
        location.reload();
    };
    logoutButton.addEventListener('click', logoutAction);
    userLogoutButton.addEventListener('click', logoutAction);

    // --- Logique d'ouverture/fermeture des réglages moteurs ---
    const openEngineSettings = () => engineSettingsOverlay.classList.remove('hidden');
    const closeEngineSettings = () => engineSettingsOverlay.classList.add('hidden');

    openEngineSettingsConsoleButton.addEventListener('click', openEngineSettings);
    openEngineSettingsUserButton.addEventListener('click', openEngineSettings);
    closeEngineSettingsButton.addEventListener('click', closeEngineSettings);
    engineSettingsOverlay.addEventListener('click', (e) => {
        // Ferme l'overlay si on clique sur le fond semi-transparent
        if (e.target === engineSettingsOverlay) {
            closeEngineSettings();
        }
    });

    // --- Logique de changement de mode ---
    const setUIMode = (isConsoleMode) => {
        if (isConsoleMode) {
            consoleModeContent.classList.remove('hidden');
            userModeContent.classList.add('hidden');
        } else {
            consoleModeContent.classList.add('hidden');
            userModeContent.classList.remove('hidden');
        }
        localStorage.setItem('lutrin-ui-mode', isConsoleMode ? 'console' : 'user');
    };

    modeToggle.addEventListener('change', (e) => {
        setUIMode(e.target.checked);
    });


    // --- Restauration et sauvegarde des choix de moteurs ---
    const savedOcrEngine = localStorage.getItem('lutrin-ocr-engine');
    if (savedOcrEngine) {
        ocrEngineSelect.value = savedOcrEngine;
    }
    ocrEngineSelect.addEventListener('change', (e) => {
        localStorage.setItem('lutrin-ocr-engine', e.target.value);
    });

    const savedTtsEngine = localStorage.getItem('lutrin-tts-engine');
    if (savedTtsEngine) {
        ttsEngineSelect.value = savedTtsEngine;
    }
    ttsEngineSelect.addEventListener('change', (e) => {
        localStorage.setItem('lutrin-tts-engine', e.target.value);
    });

    // 1. Démarrer le flux vidéo
    startLocalCamera(currentFacingMode);

    // Restaurer le mode UI
    const savedUIMode = localStorage.getItem('lutrin-ui-mode');
    const isConsole = savedUIMode === 'console';
    modeToggle.checked = isConsole;
    setUIMode(isConsole);

    // 2. Vérifier le statut de l'API toutes les 10 secondes
    checkApiStatus();
    setInterval(checkApiStatus, 30000);

    // 3. Afficher l'IP actuelle dans le statut de l'API
    const ipDisplay = apiStatus; // Use the assigned apiStatus
    ipDisplay.innerHTML = `<span class="font-bold">Serveur : ${IP_ADDRESS}:${CLIENT_PORT}</span> | `;

    // 4. Init zone stat
    statusMessage.classList.remove('bg-red-100', 'text-red-800');
    statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
}

// Au chargement de la page, on vérifie s'il y a une session active.
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser TOUS les éléments du DOM ici pour garantir leur disponibilité.
    videoStream = document.getElementById('video-stream');
    capturedImage = document.getElementById('captured-image');
    ocrTextResult = document.getElementById('ocr-text-result');
    audioPlayback = document.getElementById('audio-playback');
    captureButton = document.getElementsByClassName('capture-button');
    ocrEngineSelect = document.getElementById('ocr-engine-select');
    ttsEngineSelect = document.getElementById('tts-engine-select');
    apiStatus = document.getElementById('api-status');
    statusText = statusMessage.querySelector('span');
    statCaptureTime = document.getElementById('stat-capture-time');
    statOcrTime = document.getElementById('stat-ocr-time');
    statTtsTime = document.getElementById('stat-tts-time');

    // Initialiser les éléments du DOM qui sont toujours présents (login, offline overlay)
    loginOverlay = document.getElementById('login-overlay');
    loginForm = document.getElementById('login-form');
    rememberMeCheckbox = document.getElementById('remember-me');
    loginButton = document.getElementById('login-button');
    loginError = document.getElementById('login-error');
    mainContent = document.getElementById('main-content');
    offlineOverlay = document.getElementById('offline-overlay');
    refreshButton = document.getElementById('refresh-button');
    logoutButton = document.getElementById('logout-button');
    userLogoutButton = document.getElementById('user-logout-button');

    // Éléments des réglages moteurs
    engineSettingsOverlay = document.getElementById('engine-settings-overlay');
    closeEngineSettingsButton = document.getElementById('close-engine-settings-button');
    openEngineSettingsConsoleButton = document.getElementById('open-engine-settings-console-button');
    openEngineSettingsUserButton = document.getElementById('open-engine-settings-user-button');

    // Éléments des modes
    modeToggle = document.getElementById('mode-toggle');
    consoleModeContent = document.getElementById('console-mode-content');
    userModeContent = document.getElementById('user-mode-content');
    userVideoStream = document.getElementById('user-video-stream');
    userOcrResult = document.getElementById('user-ocr-result');
    userAudioPlayback = document.getElementById('user-audio-playback');
    userModeStopButton = document.getElementById('user-mode-stop-button');
    userModeActionButton = document.getElementById('user-mode-action-button');
    userStatusOverlay = document.getElementById('user-status-overlay');
    userStatusMessage = document.getElementById('user-status-message');
    userStatusText = document.getElementById('user-status-text');
    userErrorMessage = document.getElementById('user-error-message');
    userErrorText = document.getElementById('user-error-text');
    switchCameraButton = document.getElementById('switch-camera-button');

    // Vérifier s'il y a une session active AVANT d'attacher les écouteurs de connexion
    if (checkSession()) return; // Si la session est valide, initializeApp a déjà été appelée, on arrête ici.

    // Attacher l'écouteur de connexion
    loginButton.addEventListener('click', async () => {
        loginError.classList.add('hidden');
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP ${response.status}`);
            }

            apiKey = data.api_key;
            const sessionData = {
                apiKey: apiKey,
                loginTime: new Date().getTime()
            };

            if (rememberMeCheckbox.checked) {
                localStorage.setItem('lutrin-session', JSON.stringify(sessionData));
            } else {
                sessionStorage.setItem('lutrin-session', JSON.stringify(sessionData));
            }

            loginOverlay.classList.add('hidden');
            mainContent.classList.remove('hidden');
            initializeApp();
        } catch (error) {
            loginError.textContent = `Échec de la connexion : ${error.message}`;
            loginError.classList.remove('hidden');
        }
    });

    // --- Logique du raccourci clavier (Touche Espace) ---
    window.addEventListener('keydown', function (event) {
        // On utilise la touche Espace (keyCode 32 ou key ' ')
        if (event.key === '175') {
            // Empêche l'action par défaut (ex: défilement de la page)
            event.preventDefault();

            // Détermine quel bouton d'action est actuellement visible et actif
            if (modeToggle.checked) {
                // Mode Console : on clique sur le bouton principal de capture
                const mainCaptureButton = document.getElementById('capture-button');
                if (mainCaptureButton && !mainCaptureButton.disabled) {
                    mainCaptureButton.click();
                }
            } else {
                // Mode Utilisateur : on clique sur le bouton d'action principal
                userModeActionButton.click();
            }
        }
    });
});