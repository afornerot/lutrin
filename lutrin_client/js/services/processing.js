// js/services/processing.js
import { post, postWithFile } from '../api.js';

/**
 * Capture une image à partir d'un élément vidéo et la retourne sous forme de Blob.
 * @param {HTMLVideoElement} videoElement - L'élément vidéo source.
 * @returns {Promise<{blob: Blob, imageDataUrl: string}>} Le Blob de l'image et son Data URL.
 */
export async function captureImageFromVideo(videoElement) {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
        throw new Error("L'élément vidéo n'est pas prêt ou n'a pas de dimensions.");
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    canvas.getContext('2d').drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg');
    const blob = await (await fetch(imageDataUrl)).blob();

    return { blob, imageDataUrl };
}

/**
 * Télécharge un Blob d'image vers l'API.
 * @param {Blob} imageBlob - Le Blob de l'image à télécharger.
 * @returns {Promise<{image_filename: string}>} Les données de la réponse de l'API, incluant le nom du fichier.
 */
export async function uploadCapturedImage(imageBlob) {
    const formData = new FormData();
    formData.append('image', imageBlob, 'capture.jpg');
    return postWithFile('/upload', formData);
}

/**
 * Effectue la reconnaissance optique de caractères (OCR) sur une image.
 * @param {string} imageFilename - Le nom du fichier image sur le serveur.
 * @param {string} ocrEngine - Le moteur OCR à utiliser.
 * @returns {Promise<{text: string}>} Les données de la réponse de l'API, incluant le texte reconnu.
 */
export async function runOCR(imageFilename, ocrEngine) {
    return post('/ocr', {
        image_filename: imageFilename,
        ocr_engine: ocrEngine
    });
}

/**
 * Génère de la synthèse vocale (TTS) à partir d'un texte.
 * @param {string} text - Le texte à convertir en audio.
 * @param {string} ttsEngine - Le moteur TTS à utiliser.
 * @returns {Promise<{audio_url: string}>} Les données de la réponse de l'API, incluant l'URL de l'audio.
 */
export async function runTTS(text, ttsEngine) {
    if (!text || text.trim() === "") {
        throw new Error("Aucun texte fourni pour la synthèse vocale.");
    }
    return post('/tts', {
        text: text,
        tts_engine: ttsEngine
    });
}

/**
 * Récupère le contenu d'un fichier texte de test.
 * @param {string} filename - Le nom du fichier texte (ex: 'test01.txt').
 * @returns {Promise<string>} Le contenu du fichier texte.
 */
export async function fetchTestTextFile(filename) {
    const textFileUrl = `file/${filename}`;
    const response = await fetch(textFileUrl);
    if (!response.ok) {
        throw new Error(`Impossible de récupérer le fichier texte ${filename}: ${response.statusText}`);
    }
    return response.text();
}

/**
 * Orchestre le cycle complet : capture, upload, OCR, TTS.
 * @param {HTMLVideoElement} videoElement - L'élément vidéo pour la capture.
 * @param {string} ocrEngine - Le moteur OCR à utiliser.
 * @param {string} ttsEngine - Le moteur TTS à utiliser.
 * @returns {Promise<{audio_url: string, ocr_text: string, imageDataUrl: string, stats: {capture: number, upload: number, ocr: number, tts: number}}>}
 */
export async function processFullCycle(videoElement, ocrEngine, ttsEngine) {
    let captureStartTime, captureEndTime, uploadStartTime, uploadEndTime, ocrStartTime, ocrEndTime, ttsStartTime, ttsEndTime;
    let captureDuration = null, uploadDuration = null, ocrDuration = null, ttsDuration = null;
    let imageDataUrl = null;
    let ocrText = null;
    let audioUrl = null;

    try {
        // 1. Capture de l'image
        captureStartTime = performance.now();
        const { blob, imageDataUrl: capturedDataUrl } = await captureImageFromVideo(videoElement);
        captureEndTime = performance.now();
        captureDuration = captureEndTime - captureStartTime;
        imageDataUrl = capturedDataUrl;

        // 2. Upload de l'image
        uploadStartTime = performance.now();
        const captureData = await uploadCapturedImage(blob);
        uploadEndTime = performance.now();
        uploadDuration = uploadEndTime - uploadStartTime;

        // 3. OCR
        ocrStartTime = performance.now();
        const ocrData = await runOCR(captureData.image_filename, ocrEngine);
        ocrEndTime = performance.now();
        ocrDuration = ocrEndTime - ocrStartTime;
        ocrText = ocrData.text;

        // 4. TTS
        if (ocrText && ocrText.trim() !== "") {
            ttsStartTime = performance.now();
            const ttsData = await runTTS(ocrText, ttsEngine);
            ttsEndTime = performance.now();
            ttsDuration = ttsEndTime - ttsStartTime;
            audioUrl = ttsData.audio_url;
        } else {
            console.warn("Aucun texte détecté, pas de génération audio.");
        }

        return {
            audio_url: audioUrl,
            ocr_text: ocrText,
            imageDataUrl: imageDataUrl,
            stats: {
                capture: captureDuration,
                upload: uploadDuration,
                ocr: ocrDuration,
                tts: ttsDuration
            }
        };
    } catch (error) {
        console.error("Erreur dans le cycle de traitement complet:", error);
        throw error; // Propage l'erreur pour que la vue puisse la gérer
    }
}