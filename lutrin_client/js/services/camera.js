// js/services/camera.js

let currentStream = null;
let currentFacingMode = 'environment'; // 'environment' pour la caméra arrière, 'user' pour l'avant
let currentDeviceId = null; // Pour stocker l'ID du périphérique actuel
let currentDeviceOk = null;
let currentFacingOk = null;

/**
 * Stops the current camera stream.
 */
export function stopCamera() {
    if (currentStream) {
        console.log("Stop Camera");
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

async function getFrontCameraId() {
    let stream = null;
    try {
        // Demande la caméra frontale
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'user' } },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        });

        const track = stream.getVideoTracks()[0];
        const deviceId = track.getSettings().deviceId;

        track.stop(); // 🛑 Doit libérer le stream
        return deviceId;

    } catch (e) {
        console.warn("Caméra 'user' non trouvée ou inaccessible.");
        if (stream) stream.getTracks().forEach(t => t.stop());
        return null;
    }
}

async function getBackCameraId() {
    let stream = null;
    try {
        // Introduire un petit délai entre les bascules pour aider à la libération
        await new Promise(resolve => setTimeout(resolve, 400));

        // Demande la caméra arrière
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        });

        const track = stream.getVideoTracks()[0];
        const deviceId = track.getSettings().deviceId;

        track.stop(); // 🛑 Doit libérer le stream
        return deviceId;

    } catch (e) {
        console.warn("Caméra 'environment' non trouvée ou inaccessible.");
        if (stream) stream.getTracks().forEach(t => t.stop());
        return null;
    }
}

/**
 * Liste les périphériques d'entrée vidéo disponibles.
 * @returns {Promise<MediaDeviceInfo[]>} Une liste de périphériques vidéo.
 */
export async function getVideoDevices() {

    // Demander la permission une fois (c'est souvent nécessaire pour obtenir les IDs complets)
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const track = stream.getVideoTracks()[0];
        stream.getTracks().forEach(t => t.stop());
    } catch (err) {
        console.error("L'accès à la caméra a été refusé.", err);
        return [];
    }

    // Récupérer la liste des appareils
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');


    console.log("Liste des devices = ", videoDevices);
    return videoDevices;
}

/**
 * Starts the camera and streams it to the provided video element.
 * @param {HTMLVideoElement} videoElement - The video element to display the stream.
 * @param {object} options - Options pour démarrer la caméra.
 * @param {string} [options.facingMode] - 'user' ou 'environment'.
 * @param {string} [options.deviceId] - L'ID de périphérique spécifique à utiliser.
 * @param {boolean} [options.isFallback] - Interne: pour éviter les boucles de secours.
 * @returns {Promise<MediaStream>} The camera stream.
 */
export async function startCamera(videoElement, options = {}) {
    console.log("définition camera options = ", options);

    // On stop la camera
    stopCamera();

    // On vérifie qu'il y ait une caméra au minimum
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("La caméra n'est pas supportée par ce navigateur.");
    }

    // Résolution par défaut
    const videoConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    };

    if (options.deviceId) {
        videoConstraints.deviceId = { exact: options.deviceId };
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        currentStream = stream;

        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.play();
        }

        return stream;
    } catch (error) {
        console.error("Erreur d'accès à la caméra:", error);

        if (error.name === 'OverconstrainedError' && deviceId) {
            throw new Error(`Impossible d'accéder à la caméra avec l'ID ${deviceId}. Elle est peut-être utilisée ou déconnectée.`);
        }
        throw new Error("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
}

export function getCurrentFacingMode() {
    return currentFacingMode;
}

export function getCurrentDeviceId() {
    return currentDeviceId;
}