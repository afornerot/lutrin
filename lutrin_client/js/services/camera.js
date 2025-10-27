// js/services/camera.js

let currentStream = null;
let currentFacingMode = 'environment'; // 'environment' for back, 'user' for front

/**
 * Stops the current camera stream.
 */
export function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

/**
 * Starts the camera and streams it to the provided video element.
 * @param {HTMLVideoElement} videoElement - The video element to display the stream.
 * @param {string} facingMode - 'user' or 'environment'.
 * @returns {Promise<MediaStream>} The camera stream.
 */
export async function startCamera(videoElement, facingMode = currentFacingMode) {
    stopCamera(); // Stop any existing stream

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("La caméra n'est pas supportée par ce navigateur.");
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1920 }, // Using a more standard resolution
                height: { ideal: 1080 }
            }
        });

        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.play();
        }

        currentStream = stream;
        const videoTrack = stream.getVideoTracks()[0];
        currentFacingMode = videoTrack.getSettings().facingMode || facingMode;

        return stream;
    } catch (error) {
        console.error("Erreur d'accès à la caméra:", error);
        throw new Error("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
}

export function getCurrentFacingMode() {
    return currentFacingMode;
}