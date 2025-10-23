// --- Configuration ---
const API_BASE_URL = "http://localhost:5000";
const IP_ADDRESS = "localhost";

// --- Éléments du DOM ---
const videoStream = document.getElementById('video-stream');
const capturedImage = document.getElementById('captured-image');
const ocrTextResult = document.getElementById('ocr-text-result');
const audioPlayback = document.getElementById('audio-playback');
const captureButton = document.getElementById('capture-button');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');
const apiStatus = document.getElementById('api-status');
const statusText = statusMessage.querySelector('span');

// --- Fonctions Utilitaires ---

function showStatus(message, isError = false) {
    errorMessage.classList.add('hidden');
    statusMessage.classList.remove('hidden');
    statusText.textContent = message;
    if (isError) {
        statusMessage.classList.remove('bg-yellow-100', 'text-yellow-800');
        statusMessage.classList.add('bg-red-100', 'text-red-800');
    } else {
        statusMessage.classList.remove('bg-red-100', 'text-red-800');
        statusMessage.classList.add('bg-yellow-100', 'text-yellow-800');
    }
}

function hideStatus() {
    statusMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    statusMessage.classList.add('hidden');
}

// --- Connexion de base (Status de l'API) ---

async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (response.ok) {
            const data = await response.json();
            apiStatus.textContent = `API: EN LIGNE. Message: ${data.message}`;
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

// --- Fonction Capture, OCR et TTS ---
async function startCaptureAndOCR() {
    // 1. Désactiver le bouton et montrer le statut
    captureButton.disabled = true;
    ocrTextResult.value = "";
    audioPlayback.removeAttribute('src');

    try {
        // --- Étape 1: Capture de l'image ---
        showStatus("1/3 - Capture de l'image...", false);
        const captureResponse = await fetch(`${API_BASE_URL}/capture`, {
            method: 'POST'
        });
        if (!captureResponse.ok) {
            const errorText = await captureResponse.text(); // Lire la réponse comme du texte
            throw new Error(`Étape 1 (Capture) a échoué avec le statut ${captureResponse.status}: ${errorText}`);
        }
        const captureData = await captureResponse.json();
        capturedImage.src = captureData.image_url + "?t=" + new Date().getTime();

        // --- Étape 2: Lancement de l'OCR ---
        showStatus("2/3 - Reconnaissance du texte (OCR)...", false);
        const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_filename: captureData.image_filename
            })
        });
        if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text();
            throw new Error(`Étape 2 (OCR) a échoué avec le statut ${ocrResponse.status}: ${errorText}`);
        }
        const ocrData = await ocrResponse.json();
        ocrTextResult.value = ocrData.text;

        // --- Étape 3: Génération du TTS ---
        showStatus("3/3 - Génération de l'audio (TTS)...", false);
        const ttsResponse = await fetch(`${API_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: ocrData.text
            })
        });
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            throw new Error(`Étape 3 (TTS) a échoué avec le statut ${ttsResponse.status}: ${errorText}`);
        }
        const ttsData = await ttsResponse.json();
        audioPlayback.src = ttsData.audio_url;
        audioPlayback.load();

        // --- Fin de l'opération ---
        showStatus("Opération terminée avec succès !", false);
        statusMessage.classList.replace('bg-yellow-100', 'bg-green-100');
        statusMessage.classList.replace('text-yellow-800', 'text-green-800');
        setTimeout(hideStatus, 3000);

    } catch (error) {
        console.error("Erreur complète:", error);
        showError(`Échec de l'opération : ${error.message || error}`);
    } finally {
        // Rétablir le bouton
        captureButton.disabled = false;
    }
}

// --- Initialisation ---
function init() {
    // 1. Démarrer le flux vidéo
    videoStream.src = `${API_BASE_URL}/video`;

    // 2. Vérifier le statut de l'API toutes les 10 secondes
    checkApiStatus();
    setInterval(checkApiStatus, 30000);

    // 3. Afficher l'IP actuelle dans le statut de l'API
    const ipDisplay = document.getElementById('api-status');
    ipDisplay.innerHTML = `<span class="font-bold">IP API : ${IP_ADDRESS}:5000</span> | `;
}

window.onload = init;