// js/api.js
import { getAuthToken } from './auth.js';
import { API_BASE_URL } from './config.js';

/**
 * Fonction de base pour effectuer les requêtes fetch.
 * @param {string} endpoint - Le chemin de l'API (ex: '/login')
 * @param {object} options - Les options de la requête fetch (method, headers, body, etc.)
 * @returns {Promise<any>}
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getAuthToken();

    const defaultHeaders = { 'Accept': 'application/json' };

    // Pour les requêtes FormData, le navigateur doit définir le Content-Type lui-même.
    // Pour les autres, nous le définissons en JSON.
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }


    if (token) {
        // Le backend attend une clé 'X-API-Key' et non un header 'Authorization: Bearer'.
        defaultHeaders['X-API-Key'] = token;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        // Si le serveur renvoie une erreur (4xx, 5xx), on la propage
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Une erreur API est survenue');
    }

    // Si la réponse n'a pas de contenu (ex: 204 No Content), on retourne null
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

/**
 * Effectue une requête GET.
 * @param {string} endpoint 
 * @returns {Promise<any>}
 */
export const get = (endpoint) => apiFetch(endpoint, { method: 'GET' });

/**
 * Effectue une requête POST.
 * @param {string} endpoint 
 * @param {object} body 
 * @returns {Promise<any>}
 */
export const post = (endpoint, body) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });

/**
 * Effectue une requête POST avec des données de type FormData (pour les fichiers).
 * @param {string} endpoint 
 * @param {FormData} formData 
 * @returns {Promise<any>}
 */
export const postWithFile = (endpoint, formData) => apiFetch(endpoint, { method: 'POST', body: formData });
