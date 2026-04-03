// js/views/camera.js
import { startCamera, getCurrentFacingMode, getVideoDevices, getCurrentDeviceId } from '../services/camera.js';
import { startApiCheck, stopApiCheck } from '../services/apiStatus.js';
import {
    captureImageFromMedia,
    uploadCapturedImage,
    runOCR,
    runTTS
} from '../services/processing.js';

// --- Déclaration des variables de la vue ---
let cameraStreamContainer, cameraVideoStream, cameraAudioPlayback, cameraOcrResultContainer, cameraOcrTextResult;
let cameraModeActionButton, cameraModeStopButton;
let cameraStatusOverlay, cameraStatusMessage, cameraStatusText, cameraErrorMessage, cameraErrorText;
let videoDevices;
let currentDevice;

// Variables pour la lecture chapitre par chapitre
let chapters = [];
let currentChapterIndex = 0;
const audioQueue = new Map();
const MJPEG_STREAM_URL = 'http://localhost:8080/stream.mjpeg';
const WIFI_WEBCAM_URL_KEY = 'lutrin_wifi_webcam_url';
const fetchingPromises = new Map();
let isPlaying = false;
let isStopped = true;

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

function showOcrResultView(text) {
    cameraStreamContainer.classList.add('hidden');
    cameraOcrResultContainer.classList.remove('hidden');

    // Diviser le texte en chapitres (paragraphes) et les afficher dans le div
    chapters = text.split('\n\n').filter(c => c.trim() !== '');
    cameraOcrTextResult.innerHTML = chapters.map((chapter, index) => `
        <p id="cam-chapter-${index}" class="mb-4 p-2 rounded-md transition-colors duration-300">
            ${chapter.replace(/\n/g, '<br>')}
        </p>
    `).join('') || '<p class="text-gray-500">Aucun texte n\'a été détecté.</p>';
}

function showCameraStreamView() {
    cameraStreamContainer.classList.remove('hidden');
    cameraOcrResultContainer.classList.add('hidden');
    cameraOcrTextResult.innerHTML = '';
}

function highlightAndScrollToChapter(chapterIndex) {
    if (!cameraOcrTextResult) return;

    // Supprimer le surlignage de l'élément précédent
    const previousHighlight = cameraOcrTextResult.querySelector('.bg-yellow-200');
    if (previousHighlight) {
        previousHighlight.classList.remove('bg-yellow-200');
    }

    // Ajouter le surlignage au nouvel élément et faire défiler
    const chapterElement = document.getElementById(`cam-chapter-${chapterIndex}`);
    if (chapterElement) {
        chapterElement.classList.add('bg-yellow-200');
        chapterElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

const generateAudioForChapter = async (chapterIndex) => {
    // Si l'audio existe déjà, est en cours de génération, ou si l'index est invalide, on ne fait rien.
    if (audioQueue.has(chapterIndex) || fetchingPromises.has(chapterIndex) || chapterIndex >= chapters.length) {
        return;
    }

    const generationPromise = (async () => {
        try {
            const textToRead = chapters[chapterIndex];
            if (!textToRead || textToRead.trim() === '') {
                audioQueue.set(chapterIndex, 'silent'); // Marqueur pour les chapitres vides
                return;
            }

            stopApiCheck(); // On suspend la vérification pendant le TTS
            const ttsResult = await runTTS(textToRead);

            if (ttsResult.error && ttsResult.details && ttsResult.details.includes("Le texte fourni est vide")) {
                audioQueue.set(chapterIndex, 'silent');
                return;
            }

            // Télécharger l'audio et le stocker en tant que Blob pour éviter qu'il soit supprimé du serveur
            const absoluteAudioUrl = `${window.location.origin}${ttsResult.audio_url}`;
            const audioResponse = await fetch(absoluteAudioUrl);
            if (!audioResponse.ok) {
                throw new Error(`Impossible de télécharger l'audio depuis ${ttsResult.audio_url}`);
            }
            const audioBlob = await audioResponse.blob();

            // Créer une URL locale pour ce Blob et la stocker
            const localAudioUrl = URL.createObjectURL(audioBlob);
            audioQueue.set(chapterIndex, localAudioUrl);
            console.log(`Audio pour le chapitre ${chapterIndex} pré-chargé et stocké localement.`);

        } catch (error) {
            console.error(`Erreur lors de la génération de l'audio pour le chapitre ${chapterIndex}:`, error);
            audioQueue.set(chapterIndex, 'error');
        } finally {
            startApiCheck(); // On réactive la vérification
            fetchingPromises.delete(chapterIndex); // On retire la promesse une fois terminée
        }
    })();

    fetchingPromises.set(chapterIndex, generationPromise);
    await generationPromise; // Attendre la fin de la génération actuelle
};

const playChapter = async (chapterIndex) => {
    if (chapterIndex >= chapters.length) {
        console.log("Fin de la lecture.");
        isStopped = true;
        isPlaying = false;
        // L'événement 'ended' sur le dernier chapitre gèrera le reset de l'UI
        return;
    }

    currentChapterIndex = chapterIndex;
    // Surligner le chapitre en cours
    highlightAndScrollToChapter(chapterIndex);

    // Si l'audio n'est pas prêt, on le génère et on attend.
    if (!audioQueue.has(chapterIndex)) {
        showCameraStatus(`Génération du chapitre ${chapterIndex + 1}/${chapters.length}...`, false);
        if (!fetchingPromises.has(chapterIndex)) {
            generateAudioForChapter(chapterIndex);
        }
        await fetchingPromises.get(chapterIndex); // Attendre que la promesse de génération soit résolue
    }

    const audioUrl = audioQueue.get(chapterIndex);

    if (audioUrl && audioUrl !== 'silent' && audioUrl !== 'error') {
        cameraAudioPlayback.src = audioUrl;
        cameraAudioPlayback.play();
        return true; // Lecture démarrée
    } else {
        // Si le chapitre est vide ou en erreur, on passe au suivant.
        console.log(`Chapitre ${chapterIndex} sauté (vide ou erreur).`);
        // On ne fait pas d'appel récursif ici, on laisse l'événement 'ended' (ou son absence) gérer la suite
        // pour éviter des boucles infinies si plusieurs chapitres sont vides.
        // On simule la fin de la lecture pour ce chapitre pour déclencher le suivant.
        cameraAudioPlayback.dispatchEvent(new Event('ended'));
        return false; // Chapitre sauté
    }
};

async function handleCameraActionButtonClick() {
    setCameraActionButtonState(true);
    cameraAudioPlayback.removeAttribute('src');
    hideCameraStatus();
    stopApiCheck();

    try {
        showCameraStatus("Analyse de l'image (OCR)...", false);
        const { blob, imageDataUrl } = await captureImageFromMedia(cameraVideoStream);
        const captureData = await uploadCapturedImage(blob); // Le blocage était avant, sur le fetch du flux MJPEG
        console.log("captureData = ", captureData);
        const ocrData = await runOCR(captureData.image_filename);
        const ocrText = ocrData.text;

        showOcrResultView(ocrText); // Cette fonction remplit maintenant `chapters`

        if (chapters.length > 0) {
            isStopped = false;
            currentChapterIndex = 0;
            audioQueue.clear();
            fetchingPromises.clear();
            playChapter(0); // Démarrer la lecture du premier chapitre
        } else {
            showCameraStatus("Aucun texte détecté.", false);
            setTimeout(hideCameraStatus, 3000);
            setCameraActionButtonState(false);
        }

    } catch (error) {
        console.error("Erreur dans le mode caméra:", error);
        showCameraStatus(`Échec de l'opération : ${error.message || error}`, true);
        setCameraActionButtonState(false);
    } finally {
        startApiCheck();
    }
}

let stream = null; // Variable globale pour garder une référence au stream
export function initCameraView() {
    // Récupérer les éléments du DOM
    cameraStreamContainer = document.getElementById('camera-stream-container');
    cameraAudioPlayback = document.getElementById('camera-audio-playback');
    cameraOcrResultContainer = document.getElementById('camera-ocr-result-container');
    cameraOcrTextResult = document.getElementById('camera-ocr-text-result');
    cameraModeActionButton = document.getElementById('camera-mode-action-button');
    cameraModeStopButton = document.getElementById('camera-mode-stop-button');
    cameraStatusOverlay = document.getElementById('camera-status-overlay');
    cameraStatusMessage = document.getElementById('camera-status-message');
    cameraStatusText = document.getElementById('camera-status-text');
    cameraErrorMessage = document.getElementById('camera-error-message');
    cameraErrorText = document.getElementById('camera-error-text');

    const switchCameraButton = document.getElementById('switch-camera-button'); // Bouton de changement de caméra

    // Attacher les écouteurs d'événements
    cameraModeActionButton?.addEventListener('click', handleCameraActionButtonClick);

    // --- Logique de l'interface audio ---
    const togglePlayPause = () => {
        if (isPlaying) {
            cameraAudioPlayback.pause();
        } else {
            cameraAudioPlayback.play();
        }
    };

    const resetButtonToAction = () => {
        if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-book-open mr-4"></i> Lire la page';
        if (cameraModeActionButton) cameraModeActionButton.classList.remove('flex-grow');
        if (cameraModeActionButton) cameraModeActionButton.classList.add('w-full');
        if (cameraModeStopButton) cameraModeStopButton.classList.add('hidden');
        cameraModeActionButton?.removeEventListener('click', togglePlayPause);
        cameraModeActionButton?.addEventListener('click', handleCameraActionButtonClick);
    };

    const stopAction = () => {
        isStopped = true;
        isPlaying = false;
        cameraAudioPlayback.pause();
        cameraAudioPlayback.currentTime = 0;
        cameraAudioPlayback.removeAttribute('src');
        // Nettoyer les Blob URLs pour libérer la mémoire
        audioQueue.forEach(url => {
            if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        chapters = [];
        audioQueue.clear();
        fetchingPromises.clear();
        setCameraActionButtonState(false);
        resetButtonToAction();
        showCameraStreamView(); // Affiche à nouveau la caméra
    };
    cameraModeStopButton?.addEventListener('click', stopAction);

    cameraAudioPlayback?.addEventListener('play', () => {
        isPlaying = true;
        isStopped = false;
        hideCameraStatus();
        setCameraActionButtonState(false); // Réactive le bouton pour permettre la pause
        cameraModeActionButton?.removeEventListener('click', handleCameraActionButtonClick);
        cameraModeActionButton?.addEventListener('click', togglePlayPause);
        if (cameraModeActionButton) cameraModeActionButton.classList.add('flex-grow');
        if (cameraModeActionButton) cameraModeActionButton.classList.remove('w-full');
        if (cameraModeStopButton) cameraModeStopButton.classList.remove('hidden');
        if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-pause mr-4"></i> Pause';
    });

    cameraAudioPlayback?.addEventListener('pause', () => {
        isPlaying = false;
        if (cameraAudioPlayback.currentTime > 0 && !cameraAudioPlayback.ended) {
            if (cameraModeActionButton) cameraModeActionButton.innerHTML = '<i class="fas fa-play mr-4"></i> Lecture';
        }
    });

    cameraAudioPlayback?.addEventListener('ended', async () => {
        isPlaying = false;
        if (isStopped) {
            // Si l'utilisateur a cliqué sur "Stop", on ne fait rien de plus.
            return;
        }

        currentChapterIndex++; // On passe à l'index suivant

        let chapterPlayed = false;
        // Boucle pour sauter les chapitres vides/en erreur
        while (!chapterPlayed && currentChapterIndex < chapters.length && !isStopped) {
            chapterPlayed = await playChapter(currentChapterIndex);
            if (!chapterPlayed) {
                currentChapterIndex++; // Si le chapitre a été sauté, on passe au suivant
            }
        }

        // Si on est à la fin (ou si on a été stoppé), on réinitialise l'interface
        if (currentChapterIndex >= chapters.length || isStopped) {
            setCameraActionButtonState(false);
            resetButtonToAction();
            showCameraStreamView(); // On réaffiche la caméra à la fin de la lecture
        }
    });

    // Gestion de la pré-génération
    cameraAudioPlayback?.addEventListener('timeupdate', () => {
        // Quand on a dépassé la moitié de la lecture, on pré-génère le chapitre suivant
        if (cameraAudioPlayback.currentTime > cameraAudioPlayback.duration / 2) {
            const nextChapterIndex = currentChapterIndex + 1;
            if (nextChapterIndex < chapters.length) {
                generateAudioForChapter(nextChapterIndex);
            }
        }
    });

    // Logique pour le bouton de bascule qui parcourt toutes les caméras en boucle.
    switchCameraButton?.addEventListener('click', async () => {
        console.log("==SWITCH CAMERAS=========================================");
        try {
            if (!videoDevices || videoDevices.length === 0) {
                showCameraStatus("Aucune caméra disponible.", true);
                return;
            }
            // L'index -1 correspondra au flux MJPEG
            currentDevice--;
            if (currentDevice < 0) currentDevice = videoDevices.length - 1;
            console.log("currentDevice index = ", currentDevice);
            console.log("currentDevice = ", videoDevices[currentDevice]);

            // Nettoyer le conteneur
            cameraStreamContainer.innerHTML = '';

            if (videoDevices[currentDevice].deviceId === "mjpeg-stream") {
                // Créer et configurer l'élément <img> pour le flux MJPEG
                const img = document.createElement('img');
                img.id = 'camera-video-stream'; // Garder l'ID pour la compatibilité si besoin
                img.src = MJPEG_STREAM_URL;
                img.crossOrigin = "anonymous"; // Indispensable pour que le navigateur demande les permissions CORS
                img.className = 'w-full h-full object-contain';
                cameraStreamContainer.appendChild(img);
                cameraVideoStream = img; // Mettre à jour la référence
                console.log("Affichage du flux MJPEG Android.");
            } else if (videoDevices[currentDevice].deviceId === "wifi-webcam-stream") {
                // Créer et configurer l'élément <img> pour le flux MJPEG de la webcam WiFi
                const wifiWebcamUrl = localStorage.getItem(WIFI_WEBCAM_URL_KEY);
                if (wifiWebcamUrl) {
                    const img = document.createElement('img');
                    img.id = 'camera-video-stream';
                    img.src = wifiWebcamUrl;
                    img.crossOrigin = "anonymous";
                    img.className = 'w-full h-full object-contain';
                    cameraStreamContainer.appendChild(img);
                    cameraVideoStream = img;
                    console.log("Affichage du flux Webcam WiFi.");
                } else {
                    showCameraStatus("URL de la webcam WiFi non configurée.", true);
                }
            } else {
                // Créer et configurer l'élément <video> pour les caméras locales
                const video = document.createElement('video');
                video.id = 'camera-video-stream';
                video.autoplay = true;
                video.playsInline = true;
                video.className = 'w-full h-full object-contain';
                cameraStreamContainer.appendChild(video);
                cameraVideoStream = video; // Mettre à jour la référence
                stream = await startCamera(cameraVideoStream, { deviceId: videoDevices[currentDevice].deviceId });
            }
        } catch (error) {
            showCameraStatus(`Erreur lors du changement de caméra: ${error.message}`, true);
        }
    });

    // Démarrer la caméra
    const startAndPopulate = async () => {
        try {
            console.log("==INIT CAMERAS=========================================");
            videoDevices = await getVideoDevices();
            console.log(videoDevices);

            // On vérifie si le flux MJPEG est disponible avant de l'ajouter
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                await fetch(MJPEG_STREAM_URL, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeoutId);

                // Si la requête réussit, on ajoute la caméra MJPEG
                console.log("==AJOUT WEBCAM ANDROID (MJPEG Stream is available)==================");
                videoDevices.push({ deviceId: 'mjpeg-stream', label: 'MJPEG Stream (Android)' });
                console.log(videoDevices);
            } catch (e) {
                console.log("==WEBCAM ANDROID non ajoutée (MJPEG Stream not available)==========");
            }

            // Vérifier si une webcam WiFi est configurée
            const wifiWebcamUrl = localStorage.getItem(WIFI_WEBCAM_URL_KEY);
            if (wifiWebcamUrl) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    await fetch(wifiWebcamUrl, { mode: 'no-cors', signal: controller.signal });
                    clearTimeout(timeoutId);

                    // Si la requête réussit, on ajoute la webcam WiFi
                    console.log("==AJOUT WEBCAM WIFI (WiFi Webcam Stream is available)==================");
                    videoDevices.push({ deviceId: 'wifi-webcam-stream', label: 'Webcam WiFi' });
                    console.log(videoDevices);
                } catch (e) {
                    console.log("==WEBCAM WIFI non ajoutée (WiFi Webcam Stream not available)==========");
                }
            }

            if (videoDevices.length === 0) {
                showCameraStatus("Aucune caméra détectée.", true);
                return;
            }

            console.log("==START FIRST CAMERAS=========================================");
            currentDevice = 1;
            switchCameraButton.click();
        } catch (error) {
            showCameraStatus(`Erreur caméra: ${error.message}`, true);
        }
    };

    startAndPopulate();

    // Retourne une fonction de nettoyage pour que le routeur puisse l'utiliser
    return () => {
        console.log("Nettoyage de la vue Caméra...");
        // Arrêter le flux vidéo
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        // Arrêter la lecture audio
        if (cameraAudioPlayback) {
            cameraAudioPlayback.pause();
            cameraAudioPlayback.removeAttribute('src');
        }
        console.log("Flux caméra et audio arrêtés.");
    };
}