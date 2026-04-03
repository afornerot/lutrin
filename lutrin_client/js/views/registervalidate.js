import { post } from '../api.js';
import { navigateTo } from '../router.js';

/**
 * Initialise la vue de validation du mot de passe après l'inscription via lien magique.
 */
export function initRegisterValidateView(urlParams) {
    const token = urlParams.get('token');
    const validateForm = document.getElementById('validate-form');
    const tokenInput = document.getElementById('token');
    const validateMessage = document.getElementById('validate-message');
    const validateButton = document.getElementById('validate-button');
    const validateIcon = document.getElementById('validate-icon');
    const validateText = document.getElementById('validate-text');

    if (!validateForm) return;

    // On peuple le champ caché avec le token dès l'initialisation
    if (tokenInput) {
        tokenInput.value = token;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        const password = validateForm.password.value;
        const passwordConfirmation = validateForm.password_confirmation.value;
        const tokenFromForm = validateForm.token.value;

        // 1. Validation de la confirmation du mot de passe
        if (password !== passwordConfirmation) {
            validateMessage.textContent = "Les mots de passe ne correspondent pas.";
            validateMessage.className = 'form-status error';
            return;
        }

        // 2. Validation de la complexité du mot de passe
        const passwordRegex = /^(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
            validateMessage.textContent = "Le mot de passe doit contenir au moins 8 caractères, dont un chiffre et un caractère spécial.";
            validateMessage.className = 'form-status error';
            return;
        }

        // Désactiver le bouton et afficher un indicateur de chargement
        validateButton.disabled = true;
        validateIcon.className = 'fas fa-spinner fa-spin';
        validateText.textContent = 'Validation en cours...';
        validateMessage.textContent = '';

        try {
            // 3. Envoi en POST avec le token et le mot de passe
            const response = await post('/register/validate', { token: tokenFromForm, password: password });

            validateMessage.textContent = response.message || 'Mot de passe défini avec succès !';
            validateMessage.className = 'form-status success';
            validateForm.reset();
            setTimeout(() => navigateTo('/login'), 2000);

        } catch (error) {
            console.error("Erreur lors de la validation de l'inscription:", error);
            validateMessage.textContent = error.message || 'Une erreur inattendue est survenue.';
            validateMessage.className = 'form-status error';
        } finally {
            setTimeout(() => {
                validateButton.disabled = false;
                validateIcon.className = 'fas fa-key';
                validateText.textContent = "Valider et créer mon compte";
            }, 2000);
        }
    };

    validateForm.addEventListener('submit', handleSubmit);

    // Fonction de nettoyage à retourner au routeur
    return () => {
        console.log("Nettoyage de la vue de validation.");
        validateForm.removeEventListener('submit', handleSubmit);
    };
}