// js/auth.js
import { post } from './api.js'; // On suppose une fonction post dans api.js

const TOKEN_KEY = 'lutrin_auth_token';
const USER_KEY = 'lutrin_auth_user';
const USER_ROLE_KEY = 'lutrin_auth_role'; // Clé pour stocker le rôle de l'utilisateur

export async function login(username, password, rememberMe = false) {
    try {
        // Utilise le module api.js pour l'appel réseau
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) return false;

        const data = await response.json();
        if (data && data.api_key && data.role) {
            if (rememberMe) {
                localStorage.setItem(TOKEN_KEY, data.api_key);
                localStorage.setItem(USER_KEY, username);
                localStorage.setItem(USER_ROLE_KEY, data.role);
            } else {
                sessionStorage.setItem(TOKEN_KEY, data.api_key);
                sessionStorage.setItem(USER_KEY, username);
                sessionStorage.setItem(USER_ROLE_KEY, data.role);
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
    localStorage.removeItem(USER_ROLE_KEY);
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

/**
 * Récupère le rôle de l'utilisateur depuis le localStorage ou le sessionStorage.
 * @returns {string|null} - Le rôle de l'utilisateur ('ADMIN', 'USER') ou null.
 */
export function getAuthUserRole() {
    const localRole = localStorage.getItem(USER_ROLE_KEY);
    if (localRole) return localRole;

    const sessionRole = sessionStorage.getItem(USER_ROLE_KEY);
    if (sessionRole) return sessionRole;

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
