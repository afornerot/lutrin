import { post } from '../api.js';

/**
 * Initialise la vue d'inscription et gère la soumission du formulaire.
 */
export function initRegisterRequestView() {
    const registerForm = document.getElementById('request-form');
    const registerMessage = document.getElementById('request-message');
    const registerButton = document.getElementById('request-button');
    const registerIcon = document.getElementById('request-icon');
    const registerText = document.getElementById('request-text');

    if (!registerForm) return;

    const handleSubmit = async (event) => {
        event.preventDefault();
        const username = registerForm.username.value;
        const email = registerForm.email.value;

        // Désactiver le bouton et afficher un indicateur de chargement
        registerButton.disabled = true;
        registerIcon.className = 'fas fa-spinner fa-spin mr-2';
        registerText.textContent = 'Envoi en cours...';
        registerMessage.textContent = '';
        registerMessage.className = 'mt-4 text-center text-sm';

        try {
            const response = await post('/register/request', { username, email });

            // Le backend retourne toujours un succès pour ne pas révéler si un email existe.
            // On affiche donc toujours le message de succès.
            registerMessage.textContent = response.message;
            registerMessage.classList.add('text-green-600');
            registerForm.reset();

        } catch (error) {
            console.error("Erreur lors de la demande d'inscription:", error);
            registerMessage.textContent = error.message || 'Une erreur inattendue est survenue.';
            registerMessage.classList.add('text-red-600');
        } finally {
            // Réactiver le bouton après un court délai pour éviter le spam
            setTimeout(() => {
                registerButton.disabled = false;
                registerIcon.className = 'fas fa-user-plus mr-2';
                registerText.textContent = "Recevoir le lien d'inscription";
            }, 2000);
        }
    };

    registerForm.addEventListener('submit', handleSubmit);

    // Fonction de nettoyage à retourner au routeur
    return () => {
        console.log("Nettoyage de la vue d'inscription.");
        registerForm.removeEventListener('submit', handleSubmit);
    };
}