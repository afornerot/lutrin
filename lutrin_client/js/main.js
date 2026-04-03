// js/main.js
import { initRouter } from './router.js';
import { checkAuth } from './auth.js';
import { initApiStatus } from './services/apiStatus.js';

// Fonction principale qui démarre l'application
async function bootstrap() {
    console.log("Application Lutrin Client démarrée.");
    initApiStatus(); // Initialise la surveillance de l'API
    initRouter(); // Initialise le routeur qui gère les changements de vue
}

// Lancer l'application une fois que le DOM est prêt
document.addEventListener('DOMContentLoaded', bootstrap);
