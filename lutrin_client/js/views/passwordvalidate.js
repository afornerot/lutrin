import { post } from '../api.js';
import { navigateTo } from '../router.js';

export function initPasswordValidateView(urlParams) {
    const token = urlParams.get('token');
    const form = document.getElementById('validate-form');
    const tokenInput = document.getElementById('token');
    const messageDiv = document.getElementById('validate-message');
    const button = document.getElementById('validate-button');

    if (!form) return;

    if (tokenInput) tokenInput.value = token;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const password = form.password.value;
        const passwordConfirmation = form.password_confirmation.value;
        const tokenFromForm = form.token.value;

        if (password !== passwordConfirmation) {
            messageDiv.textContent = "Les mots de passe ne correspondent pas.";
            messageDiv.className = 'mt-4 text-center text-sm text-red-600';
            return;
        }

        const passwordRegex = /^(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
            messageDiv.textContent = "Le mot de passe doit contenir au moins 8 caractères, dont un chiffre et un caractère spécial.";
            messageDiv.className = 'mt-4 text-center text-sm text-red-600';
            return;
        }

        button.disabled = true;
        button.textContent = 'Réinitialisation en cours...';

        try {
            const response = await post('/password/validate', { token: tokenFromForm, password });
            messageDiv.textContent = response.message;
            messageDiv.className = 'mt-4 text-center text-sm text-green-600';
            form.reset();
            setTimeout(() => navigateTo('/login'), 2000);
        } catch (error) {
            messageDiv.textContent = error.message || 'Une erreur est survenue.';
            messageDiv.className = 'mt-4 text-center text-sm text-red-600';
            button.disabled = false;
            button.textContent = 'Réinitialiser le mot de passe';
        }
    };

    form.addEventListener('submit', handleSubmit);
    return () => form.removeEventListener('submit', handleSubmit);
}