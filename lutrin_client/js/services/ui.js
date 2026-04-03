// js/services/ui.js
import { get } from '../api.js';
import { runTTS } from './processing.js';
import { logout, getAuthUserRole } from '../auth.js';

/**
 * Initialise les écouteurs d'événements pour la barre de navigation principale.
 * Doit être appelée après que le template du header a été injecté dans le DOM.
 */
export function initHeader() {
    const settingsButton = document.getElementById('main-settings-button');
    const logoutButton = document.getElementById('main-logout-button'); // Correction: Il y avait une div en trop dans le HTML du header

    settingsButton?.addEventListener('click', openSettingsModal);
    logoutButton?.addEventListener('click', logout);

    console.log("Header UI initialisé.");
}

/**
 * Met à jour la visibilité des liens de navigation en fonction du rôle de l'utilisateur.
 * Cache les éléments avec l'attribut `data-admin-only="true"` si l'utilisateur n'est pas ADMIN.
 */
export function updateHeaderNav() {
    const userRole = getAuthUserRole();
    const adminOnlyLinks = document.querySelectorAll('[data-admin-only="true"]');

    if (userRole !== 'ADMIN') {
        adminOnlyLinks.forEach(link => {
            link.style.display = 'none';
        });
    } else {
        // S'assurer que les liens sont visibles pour les admins
        adminOnlyLinks.forEach(link => link.style.display = '');
    }
}

/**
 * Initialise les éléments d'interface partagés à travers différentes vues,
 * comme la modale de configuration.
 */
let isSharedUIInitialized = false;

export function initSharedUI() {
    if (isSharedUIInitialized) {
        return; // Ne rien faire si l'UI partagée est déjà initialisée
    }

    // Logique pour la modale des moteurs
    const settingsOverlay = document.getElementById('engine-settings-overlay');
    const ocrEngineSelect = document.getElementById('ocr-engine-select');
    const ttsEngineSelect = document.getElementById('tts-engine-select');
    const closeSettingsButton = document.getElementById('close-engine-settings-button');
    const piperModelContainer = document.getElementById('piper-model-selector-container');
    const piperModelSelect = document.getElementById('piper-model-select');
    const piperSpeedSlider = document.getElementById('piper-speed-slider');
    const piperSpeedValue = document.getElementById('piper-speed-value');
    const testTtsButton = document.getElementById('test-tts-button');
    const testTtsAudio = document.getElementById('test-tts-audio');

    const OCR_ENGINE_KEY = 'lutrin_ocr_engine';
    const TTS_ENGINE_KEY = 'lutrin_tts_engine';
    const PIPER_MODEL_KEY = 'lutrin_piper_model';
    const PIPER_SPEED_KEY = 'lutrin_piper_speed';
    const WIFI_WEBCAM_URL_KEY = 'lutrin_wifi_webcam_url';

    // --- Sauvegarde des préférences ---
    ocrEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(OCR_ENGINE_KEY, e.target.value);
        console.log(`Moteur OCR sauvegardé : ${e.target.value}`);
    });

    ttsEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(TTS_ENGINE_KEY, e.target.value);
        console.log(`Moteur TTS sauvegardé : ${e.target.value}`);
    });

    // --- Logique pour le sélecteur de modèle Piper ---
    const togglePiperModelSelector = () => {
        if (ttsEngineSelect.value === 'piper') {
            piperModelContainer.classList.remove('hidden');
        } else {
            piperModelContainer.classList.add('hidden');
        }
    };

    const loadPiperModels = async () => {
        try {
            const response = await get('/tts/piper-models');
            const models = response.models || [];
            piperModelSelect.innerHTML = models.map(model => `<option value="${model}">${model}</option>`).join('');

            // Restaurer la sélection
            const savedPiperModel = localStorage.getItem(PIPER_MODEL_KEY);
            if (savedPiperModel && models.includes(savedPiperModel)) {
                piperModelSelect.value = savedPiperModel;
            } else if (models.length > 0) {
                // Si aucun modèle n'est sauvegardé, on sauvegarde le premier de la liste
                localStorage.setItem(PIPER_MODEL_KEY, models[0]);
            }
        } catch (error) {
            console.error("Impossible de charger les modèles Piper:", error);
            piperModelContainer.classList.add('hidden');
        }
    };

    ttsEngineSelect.addEventListener('change', togglePiperModelSelector);
    piperModelSelect.addEventListener('change', () => {
        localStorage.setItem(PIPER_MODEL_KEY, piperModelSelect.value);
    });

    // --- Logique pour le curseur de vitesse Piper ---
    const updateSpeedDisplay = (value) => {
        const speed = parseFloat(value);
        if (speed < 1.0) piperSpeedValue.textContent = "Lente";
        else if (speed > 1.3) piperSpeedValue.textContent = "Très Rapide";
        else if (speed > 1.1) piperSpeedValue.textContent = "Rapide";
        else piperSpeedValue.textContent = "Normale";
    };

    piperSpeedSlider.addEventListener('input', () => updateSpeedDisplay(piperSpeedSlider.value));
    piperSpeedSlider.addEventListener('change', () => {
        localStorage.setItem(PIPER_SPEED_KEY, piperSpeedSlider.value);
    });

    // --- Logique pour le bouton de test TTS ---
    testTtsButton?.addEventListener('click', async () => {
        console.log("Test TTS en cours...");

        const testText = "Je ne connaîtrai pas la peur, car la peur tue l’esprit. La peur est la petite mort qui conduit à l’oblitération totale. J’affronterai ma peur. Je lui permettrai de passer sur moi, au travers de moi. Et lorsqu’elle sera passée, je tournerai mon œil intérieur sur son chemin. Et là où elle sera passée, il n’y aura plus rien. Rien que moi.";

        const originalButtonContent = testTtsButton.innerHTML;
        testTtsButton.disabled = true;
        testTtsButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération...';

        try {
            const ttsResult = await runTTS(testText);

            // Télécharger l'audio et le stocker localement pour éviter qu'il soit purgé
            const audioResponse = await fetch(ttsResult.audio_url);
            if (!audioResponse.ok) {
                throw new Error(`Impossible de télécharger l'audio de test.`);
            }
            const audioBlob = await audioResponse.blob();
            const localAudioUrl = URL.createObjectURL(audioBlob);

            testTtsAudio.src = localAudioUrl;
            testTtsAudio.play();

            const onEndOrError = () => {
                testTtsButton.disabled = false;
                testTtsButton.innerHTML = originalButtonContent;

                // Nettoyer l'URL du Blob pour libérer la mémoire
                URL.revokeObjectURL(localAudioUrl);
                testTtsAudio.removeEventListener('ended', onEndOrError);
                testTtsAudio.removeEventListener('error', onEndOrError);

            };

            testTtsAudio.addEventListener('ended', onEndOrError);
            testTtsAudio.addEventListener('error', onEndOrError);

        } catch (error) {
            console.error("Erreur lors du test TTS:", error);
            alert(`Erreur lors de la génération du test : ${error.message}`);
            testTtsButton.disabled = false;
            testTtsButton.innerHTML = originalButtonContent;
        }
    });

    // --- Logique pour la webcam WiFi ---
    const wifiWebcamUrlInput = document.getElementById('wifi-webcam-url');
    const testWifiWebcamButton = document.getElementById('test-wifi-webcam-button');

    // Charger l'URL sauvegardée
    const savedWifiWebcamUrl = localStorage.getItem(WIFI_WEBCAM_URL_KEY);
    if (savedWifiWebcamUrl && wifiWebcamUrlInput) {
        wifiWebcamUrlInput.value = savedWifiWebcamUrl;
    }

    // Sauvegarder l'URL quand elle change
    wifiWebcamUrlInput?.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        if (url) {
            localStorage.setItem(WIFI_WEBCAM_URL_KEY, url);
            console.log(`URL webcam WiFi sauvegardée : ${url}`);
        }
    });

    // Tester la connexion à la webcam WiFi
    testWifiWebcamButton?.addEventListener('click', async () => {
        const url = wifiWebcamUrlInput.value.trim();
        if (!url) {
            alert('Veuillez entrer une URL valide');
            return;
        }

        const originalButtonContent = testWifiWebcamButton.innerHTML;
        testWifiWebcamButton.disabled = true;
        testWifiWebcamButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Test en cours...';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, { 
                mode: 'no-cors',
                signal: controller.signal 
            });
            clearTimeout(timeoutId);

            // Si on arrive ici, la connexion est réussie (même si on ne peut pas lire la réponse en no-cors)
            localStorage.setItem(WIFI_WEBCAM_URL_KEY, url);
            alert('Connexion réussie ! La webcam WiFi est configurée.');
        } catch (error) {
            console.error('Erreur de connexion à la webcam WiFi:', error);
            if (error.name === 'AbortError') {
                alert('Délai de connexion dépassé. Vérifiez l\'URL et la connectivité.');
            } else {
                alert(`Erreur de connexion : ${error.message}`);
            }
        } finally {
            testWifiWebcamButton.disabled = false;
            testWifiWebcamButton.innerHTML = originalButtonContent;
        }
    });

    // --- Restauration des préférences au chargement ---
    const savedOcrEngine = localStorage.getItem(OCR_ENGINE_KEY);
    const savedTtsEngine = localStorage.getItem(TTS_ENGINE_KEY);
    const savedPiperSpeed = localStorage.getItem(PIPER_SPEED_KEY) || 1.15; // Valeur par défaut
    const savedWifiUrl = localStorage.getItem(WIFI_WEBCAM_URL_KEY);

    if (savedOcrEngine && ocrEngineSelect) ocrEngineSelect.value = savedOcrEngine;
    if (savedTtsEngine && ttsEngineSelect) ttsEngineSelect.value = savedTtsEngine;
    if (piperSpeedSlider) piperSpeedSlider.value = savedPiperSpeed;
    if (savedWifiUrl && wifiWebcamUrlInput) wifiWebcamUrlInput.value = savedWifiUrl;
    updateSpeedDisplay(savedPiperSpeed);

    // Gère la fermeture de la modale
    closeSettingsButton?.addEventListener('click', () => {
        settingsOverlay?.classList.add('hidden');
    });

    console.log("Shared UI initialisée.");
    loadPiperModels();
    togglePiperModelSelector();

    isSharedUIInitialized = true;
}

export function openSettingsModal() {
    const settingsOverlay = document.getElementById('engine-settings-overlay');
    settingsOverlay?.classList.remove('hidden');
}