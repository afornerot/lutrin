// js/auth.js
import { post } from './api.js'; // On suppose une fonction post dans api.js

const TOKEN_KEY = 'lutrin_auth_token';
const USER_KEY = 'lutrin_auth_user'; // Clé pour stocker le nom d'utilisateur

export async function login(username, password, rememberMe = false) {
    try {
        // Utilise le module api.js pour l'appel réseau
        const data = await post('/login', { username, password });
        // Vérifions la clé 'api_key' que le backend semble renvoyer, au lieu de 'token'.
        if (data && data.api_key) {
            if (rememberMe) {
                localStorage.setItem(TOKEN_KEY, data.api_key);
                localStorage.setItem(USER_KEY, username);
                sessionStorage.removeItem(TOKEN_KEY); // S'assurer qu'il n'y a pas de doublon
            } else {
                sessionStorage.setItem(TOKEN_KEY, data.api_key);
                sessionStorage.setItem(USER_KEY, username);
                localStorage.clear(); // Nettoyer le localStorage si on ne se souvient pas
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error("Login failed:", error.message);
        // Si l'erreur est due à des identifiants incorrects, l'API devrait renvoyer un statut/message spécifique.
        // Pour l'instant, nous renvoyons simplement false. La vue affichera une erreur générique.
        if (error.message.includes('Identifiants incorrects')) {
            throw new Error('Identifiants incorrects.');
        }
        return false;
    }
}

export function logout() {
    // Il faut supprimer la clé des deux stockages possibles.
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);

    // Forcer le rechargement de la page vers la mire de connexion pour nettoyer tout l'état.
    history.replaceState(null, '', '/login'); // Utilise history.replaceState
    location.reload();
}

// Vérifie la présence d'un token valide dans localStorage ou sessionStorage
export function checkAuth() {
    return localStorage.getItem(TOKEN_KEY) !== null || sessionStorage.getItem(TOKEN_KEY) !== null;
}

// Récupère le token depuis localStorage ou sessionStorage
export function getAuthToken() {
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (localToken) return localToken;

    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    if (sessionToken) return sessionToken;

    return null;
}

// Récupère le nom de l'utilisateur depuis localStorage ou sessionStorage
export function getAuthUser() {
    const localUser = localStorage.getItem(USER_KEY);
    if (localUser) return localUser;

    const sessionUser = sessionStorage.getItem(USER_KEY);
    if (sessionUser) return sessionUser;

    return null;
}
