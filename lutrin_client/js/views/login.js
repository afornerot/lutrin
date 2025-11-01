// js/views/login.js
import { login } from '../auth.js';

function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const username = form.username.value;
    const password = form.password.value;
    const errorDiv = document.getElementById('login-error');
    const rememberMe = document.getElementById('remember-me').checked; // Récupère l'état de la case "Rester connecté"
    const submitButton = document.getElementById('login-button'); // Récupère le bouton de connexion par son ID

    errorDiv.textContent = ''; // Réinitialiser le message d'erreur
    submitButton.disabled = true; // Désactive le bouton pendant la connexion
    submitButton.textContent = 'Connexion en cours...'; // Change le texte du bouton

    login(username, password, rememberMe) // Passe l'état de "rememberMe" à la fonction de login
        .then(isLoggedIn => {
            if (isLoggedIn) {
                // On change le hash PUIS on recharge. Au rechargement, le routeur verra le nouveau hash et l'état connecté.
                history.replaceState(null, '', '/camera'); // Utilise history.replaceState
                location.reload();
            } else {
                errorDiv.textContent = 'Identifiants incorrects ou une erreur est survenue.';
                submitButton.disabled = false; // Réactive le bouton
                submitButton.textContent = 'Se connecter'; // Rétablit le texte du bouton
            }
        })
        // Le bloc catch gérera les erreurs réseau ou les erreurs API provenant de auth.js
        .catch(err => {
            console.error('Login error:', err);
            errorDiv.textContent = 'Une erreur est survenue.';
        });
}

export function initLoginView() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
}
