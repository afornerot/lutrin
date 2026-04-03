import { post } from '../api.js';

export function initPasswordRequestView() {
    const form = document.getElementById('request-form');
    const messageDiv = document.getElementById('request-message');
    const button = document.getElementById('request-button');

    if (!form) return;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const email = form.email.value;

        button.disabled = true;
        button.textContent = 'Envoi en cours...';
        messageDiv.textContent = '';
        messageDiv.className = 'mt-4 text-center text-sm';

        try {
            const response = await post('/password/request', { email });
            messageDiv.textContent = response.message;
            messageDiv.classList.add('text-green-600');
            form.reset();
        } catch (error) {
            // Même en cas d'erreur, on affiche un message générique pour la sécurité
            messageDiv.textContent = "Si un compte est associé à cette adresse, un e-mail de réinitialisation a été envoyé.";
            messageDiv.classList.add('text-green-600');
        } finally {
            setTimeout(() => {
                button.disabled = false;
                button.textContent = 'Envoyer le lien';
            }, 2000);
        }
    };

    form.addEventListener('submit', handleSubmit);
    return () => form.removeEventListener('submit', handleSubmit);
}