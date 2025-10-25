// --- Configuration ---
const API_BASE_URL = "http://localhost:5000";
const IP_ADDRESS = "localhost";

// --- Éléments du DOM ---
const videoStream = document.getElementById('video-stream');
const capturedImage = document.getElementById('captured-image');
const ocrTextResult = document.getElementById('ocr-text-result');
const audioPlayback = document.getElementById('audio-playback');
const captureButton = document.getElementsByClassName('capture-button');
const ocrEngineSelect = document.getElementById('ocr-engine-select');
const ttsEngineSelect = document.getElementById('tts-engine-select');

// Statut et messages
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');
const apiStatus = document.getElementById('api-status');
const statusText = statusMessage.querySelector('span');

// Éléments pour les statistiques
const statCaptureTime = document.getElementById('stat-capture-time');
const statOcrTime = document.getElementById('stat-ocr-time');
const statTtsTime = document.getElementById('stat-tts-time');

// Fonctions Utilitaires ---
/**
 * Affiche un message de statut, gérant les états d'erreur et de succès.
 * @param {string} message - Le message à afficher.
 * @param {boolean} isError - True si le message est une erreur.
 * @param {boolean} isSuccess - True si le message est un succès.
 */
function showStatus(message, isError = false, isSuccess = false) {
    errorMessage.classList.add('hidden');
    statusMessage.classList.remove('hidden', 'bg-yellow-100', 'text-yellow-800', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
    statusText.textContent = message;

    if (isError) statusMessage.classList.add('bg-red-100', 'text-red-800');
    else if (isSuccess) statusMessage.classList.add('bg-green-100', 'text-green-800');
    else statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    statusMessage.classList.add('hidden');
}

function hideStatus() {
    statusMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');
}

function setCaptureButtonsState(disabled) {
    for (const button of captureButton) {
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
            const data = await response.json();
            apiStatus.textContent = `API: EN LIGNE. Message: ${data.status}`;
            apiStatus.classList.remove('text-red-500');
            apiStatus.classList.add('text-green-500');
        } else {
            apiStatus.textContent = `API: HORS LIGNE (Erreur HTTP ${response.status})`;
            apiStatus.classList.remove('text-green-500');
            apiStatus.classList.add('text-red-500');
        }
    } catch (error) {
        apiStatus.textContent = "API: HORS LIGNE (Impossible de se connecter)";
        apiStatus.classList.remove('text-green-500');
        apiStatus.classList.add('text-red-500');
    }
}

async function startCaptureAndOCR() {
    // 1. Désactiver le bouton et montrer le statut
    setCaptureButtonsState(true);
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');
    clearStats(); // Réinitialiser les stats

    let captureStartTime, captureEndTime, ocrStartTime, ocrEndTime, ttsStartTime, ttsEndTime;
    let captureDuration = null, ocrDuration = null, ttsDuration = null;

    try {
        // --- Étape 1: Capture de l'image ---
        showStatus("1/3 - Capture de l'image...", false);
        captureStartTime = performance.now();
        const captureResponse = await fetch(`${API_BASE_URL}/capture`, {
            method: 'POST'
        });
        if (!captureResponse.ok) {
            const errorText = await captureResponse.text(); // Lire la réponse comme du texte
            throw new Error(`Étape 1 (Capture) a échoué avec le statut ${captureResponse.status}: ${errorText}`);
        }
        const captureData = await captureResponse.json();
        captureEndTime = performance.now();
        captureDuration = captureEndTime - captureStartTime;
        capturedImage.src = captureData.image_url + "?t=" + new Date().getTime();

        // --- Étape 2: Lancement de l'OCR ---
        showStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        ocrStartTime = performance.now();
        const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        ocrTextResult.value = ocrData.text;

        // --- Étape 3: Génération du TTS ---
        showStatus("3/3 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        audioPlayback.src = ttsData.audio_url;
        audioPlayback.load();
        audioPlayback.play();

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
        capturedImage.src = API_BASE_URL + "/file/" + fichier + "?t=" + new Date().getTime();
        // Simuler un petit délai pour le chargement visuel
        await new Promise(resolve => setTimeout(resolve, 200));
        captureEndTime = performance.now();
        captureDuration = captureEndTime - captureStartTime;

        // --- Étape 2: Lancement de l'OCR ---
        showStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        ocrStartTime = performance.now();
        const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        ocrTextResult.value = ocrData.text;

        // --- Étape 3: Génération du TTS ---
        showStatus("3/3 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        audioPlayback.src = ttsData.audio_url;
        audioPlayback.load();
        audioPlayback.play();

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
        const textFileUrl = `${API_BASE_URL}/file/${fichier}`;
        const textResponse = await fetch(textFileUrl);
        if (!textResponse.ok) {
            throw new Error(`Étape 1 (Récupération texte) a échoué avec le statut ${textResponse.status}`);
        }
        const textContent = await textResponse.text();
        textFetchEndTime = performance.now();
        textFetchDuration = textFetchEndTime - textFetchStartTime;
        ocrTextResult.value = textContent; // Afficher le texte dans la textarea

        // --- Étape 2: Génération du TTS ---
        showStatus("2/2 - Génération de l'audio (TTS)...", false);
        ttsStartTime = performance.now();
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        audioPlayback.src = ttsData.audio_url;
        audioPlayback.load();



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
        audioPlayback.play();

    }
}

async function noOCR() {
    const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
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
function init() {
    // 1. Démarrer le flux vidéo
    videoStream.src = `${API_BASE_URL}/video`;

    // 2. Vérifier le statut de l'API toutes les 10 secondes
    checkApiStatus();
    setInterval(checkApiStatus, 30000);

    // 3. Afficher l'IP actuelle dans le statut de l'API
    const ipDisplay = document.getElementById('api-status');
    ipDisplay.innerHTML = `<span class="font-bold">IP API : ${IP_ADDRESS}:5000</span> | `;

    // 4. Init zone stat
    statusMessage.classList.remove('bg-red-100', 'text-red-800');
    statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
}

window.onload = init;