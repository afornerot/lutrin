// js/services/processing.js
import { post, postWithFile } from '../api.js';

/**
 * Capture une image à partir d'un élément vidéo ou image et la retourne sous forme de Blob.
 * @param {HTMLVideoElement | HTMLImageElement} mediaElement - L'élément source (vidéo ou image).
 * @returns {Promise<{blob: Blob, imageDataUrl: string}>} Le Blob de l'image et son Data URL.
 */
export async function captureImageFromMedia(mediaElement) {
    if (!mediaElement) {
        throw new Error("L'élément média n'est pas fourni.");
    }

    const isVideo = mediaElement.tagName === 'VIDEO';
    const width = isVideo ? mediaElement.videoWidth : mediaElement.naturalWidth;
    const height = isVideo ? mediaElement.videoHeight : mediaElement.naturalHeight;

    if (!width || !height) {
        throw new Error("L'élément média n'est pas prêt ou n'a pas de dimensions.");
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(mediaElement, 0, 0, canvas.width, canvas.height);

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
 * @returns {Promise<{text: string}>} Les données de la réponse de l'API, incluant le texte reconnu.
 */
export async function runOCR(imageFilename) {
    const ocrEngine = localStorage.getItem('lutrin_ocr_engine') || 'groq';
    return post('/ocr', {
        image_filename: imageFilename,
        ocr_engine: ocrEngine
    });
}

/**
 * Génère de la synthèse vocale (TTS) à partir d'un texte.
 * @param {string} text - Le texte à convertir en audio.
 * @returns {Promise<{audio_url: string}>} Les données de la réponse de l'API, incluant l'URL de l'audio.
 */
export async function runTTS(text) {
    if (!text || text.trim() === "") {
        throw new Error("Aucun texte fourni pour la synthèse vocale.");
    }
    // On inverse la valeur du slider car pour Piper, length_scale > 1.0 = plus lent.
    // Le slider va de 0.75 (lent) à 1.5 (rapide) pour l'utilisateur.
    // On mappe cette plage sur la plage de Piper, par exemple 1.3 (lent) à 0.8 (rapide).
    const userSpeed = parseFloat(localStorage.getItem('lutrin_piper_speed') || 1.15);
    const piperLengthScale = 1.0 / (userSpeed / 1.15); // Inverser et normaliser

    const ttsEngine = localStorage.getItem('lutrin_tts_engine') || 'piper';
    const piperModel = localStorage.getItem('lutrin_piper_model') || 'fr_FR-siwis-medium.onnx';
    return post('/tts', {
        text: text,
        tts_engine: ttsEngine,
        piper_model_name: piperModel,
        length_scale: piperLengthScale
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