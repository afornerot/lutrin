// js/views/settings.js
import { get } from '../api.js';
import { runTTS } from '../services/processing.js';

export function initSettingsView() {
    const ocrEngineSelect = document.getElementById('ocr-engine-select');
    const ttsEngineSelect = document.getElementById('tts-engine-select');
    const piperModelContainer = document.getElementById('piper-model-selector-container');
    const piperModelSelect = document.getElementById('piper-model-select');
    const piperSpeedSlider = document.getElementById('piper-speed-slider');
    const geminiVoiceContainer = document.getElementById('gemini-voice-selector-container');
    const geminiVoiceSelect = document.getElementById('gemini-voice-select');
    const piperSpeedValue = document.getElementById('piper-speed-value');
    const testTtsButton = document.getElementById('test-tts-button');
    const testTtsAudio = document.getElementById('test-tts-audio');
    const wifiWebcamUrlInput = document.getElementById('wifi-webcam-url');
    const testWifiWebcamButton = document.getElementById('test-wifi-webcam-button');
    const uiScaleSlider = document.getElementById('ui-scale-slider');
    const uiScaleValue = document.getElementById('ui-scale-value');

    const OCR_ENGINE_KEY = 'lutrin_ocr_engine';
    const TTS_ENGINE_KEY = 'lutrin_tts_engine';
    const PIPER_MODEL_KEY = 'lutrin_piper_model';
    const PIPER_SPEED_KEY = 'lutrin_piper_speed';
    const GEMINI_VOICE_KEY = 'lutrin_gemini_voice';
    const WIFI_WEBCAM_URL_KEY = 'lutrin_wifi_webcam_url';
    const UI_SCALE_KEY = 'lutrin_ui_scale';

    // --- Échelle de l'interface ---
    const applyUiScale = (value) => {
        document.body.style.setProperty('--ui-scale', value);
        const pct = Math.round(parseFloat(value) * 100);
        if (uiScaleValue) uiScaleValue.textContent = `${pct}%`;
    };

    const savedUiScale = localStorage.getItem(UI_SCALE_KEY);
    if (savedUiScale && uiScaleSlider) {
        uiScaleSlider.value = savedUiScale;
        applyUiScale(savedUiScale);
    }

    uiScaleSlider?.addEventListener('input', () => {
        applyUiScale(uiScaleSlider.value);
    });

    uiScaleSlider?.addEventListener('change', () => {
        localStorage.setItem(UI_SCALE_KEY, uiScaleSlider.value);
    });

    // --- Sauvegarde des préférences ---
    ocrEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(OCR_ENGINE_KEY, e.target.value);
    });

    ttsEngineSelect?.addEventListener('change', (e) => {
        localStorage.setItem(TTS_ENGINE_KEY, e.target.value);
    });

    // --- Toggle modèle Piper et voix Gemini ---
    const toggleModelSelector = () => {
        piperModelContainer.classList.add('hidden');
        geminiVoiceContainer.classList.add('hidden');

        if (ttsEngineSelect.value === 'piper') {
            piperModelContainer.classList.remove('hidden');
            loadPiperModels();
        } else if (ttsEngineSelect.value === 'gemini') {
            geminiVoiceContainer.classList.remove('hidden');
            loadGeminiVoices();
        }
    };

    ttsEngineSelect?.addEventListener('change', toggleModelSelector);

    const loadPiperModels = async () => {
        try {
            const response = await get('/tts/piper-models');
            const models = response.models || [];
            piperModelSelect.innerHTML = models.map(model => `<option value="${model}">${model}</option>`).join('');

            const savedPiperModel = localStorage.getItem(PIPER_MODEL_KEY);
            if (savedPiperModel && models.includes(savedPiperModel)) {
                piperModelSelect.value = savedPiperModel;
            } else {
                const defaultModel = 'fr_FR-siwis-medium.onnx';
                if (models.includes(defaultModel)) {
                    piperModelSelect.value = defaultModel;
                } else if (models.length > 0) {
                    piperModelSelect.value = models[0];
                }
                localStorage.setItem(PIPER_MODEL_KEY, piperModelSelect.value);
            }
        } catch (error) {
            console.error("Impossible de charger les modèles Piper:", error);
        }
    };

    piperModelSelect?.addEventListener('change', () => {
        localStorage.setItem(PIPER_MODEL_KEY, piperModelSelect.value);
    });

    const loadGeminiVoices = async () => {
        try {
            const response = await get('/tts/gemini-voices');
            const voices = response.voices || [];
            geminiVoiceSelect.innerHTML = voices.map(v => `<option value="${v.id}">${v.name} (${v.lang})</option>`).join('');

            const savedVoice = localStorage.getItem(GEMINI_VOICE_KEY);
            if (savedVoice && voices.find(v => v.id === savedVoice)) {
                geminiVoiceSelect.value = savedVoice;
            } else {
                const frenchVoice = voices.find(v => v.lang === 'fr');
                if (frenchVoice) {
                    geminiVoiceSelect.value = frenchVoice.id;
                } else {
                    geminiVoiceSelect.value = voices[0]?.id;
                }
                if (geminiVoiceSelect.value) {
                    localStorage.setItem(GEMINI_VOICE_KEY, geminiVoiceSelect.value);
                }
            }
        } catch (error) {
            console.error("Impossible de charger les voix Gemini:", error);
        }
    };

    geminiVoiceSelect?.addEventListener('change', () => {
        localStorage.setItem(GEMINI_VOICE_KEY, geminiVoiceSelect.value);
    });

    // --- Vitesse Piper ---
    const updateSpeedDisplay = (value) => {
        const speed = parseFloat(value);
        if (speed < 1.0) piperSpeedValue.textContent = "Lente";
        else if (speed > 1.3) piperSpeedValue.textContent = "Très Rapide";
        else if (speed > 1.1) piperSpeedValue.textContent = "Rapide";
        else piperSpeedValue.textContent = "Normale";
    };

    piperSpeedSlider?.addEventListener('input', () => updateSpeedDisplay(piperSpeedSlider.value));
    piperSpeedSlider?.addEventListener('change', () => {
        localStorage.setItem(PIPER_SPEED_KEY, piperSpeedSlider.value);
    });

    // --- Test TTS ---
    testTtsButton?.addEventListener('click', async () => {
        const testText = "Je ne connaîtrai pas la peur, car la peur tue l'esprit. La peur est la petite mort qui conduit à l'oblitération totale. J'affronterai ma peur. Je lui permettrai de passer sur moi, au travers de moi. Et lorsqu'elle sera passée, je tournerai mon œil intérieur sur son chemin. Et là où elle sera passée, il n'y aura plus rien. Rien que moi.";

        const originalButtonContent = testTtsButton.innerHTML;
        testTtsButton.disabled = true;
        testTtsButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération...';

        try {
            const ttsResult = await runTTS(testText);
            const audioResponse = await fetch(ttsResult.audio_url);
            if (!audioResponse.ok) throw new Error('Impossible de télécharger l\'audio de test.');

            const audioBlob = await audioResponse.blob();
            const localAudioUrl = URL.createObjectURL(audioBlob);
            testTtsAudio.src = localAudioUrl;
            testTtsAudio.play();

            const onEndOrError = () => {
                testTtsButton.disabled = false;
                testTtsButton.innerHTML = originalButtonContent;
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

    // --- Webcam WiFi ---
    const savedWifiUrl = localStorage.getItem(WIFI_WEBCAM_URL_KEY);
    if (savedWifiUrl && wifiWebcamUrlInput) {
        wifiWebcamUrlInput.value = savedWifiUrl;
    }

    wifiWebcamUrlInput?.addEventListener('change', (e) => {
        const url = e.target.value.trim();
        if (url) {
            localStorage.setItem(WIFI_WEBCAM_URL_KEY, url);
        } else {
            localStorage.removeItem(WIFI_WEBCAM_URL_KEY);
        }
    });

    testWifiWebcamButton?.addEventListener('click', async () => {
        const url = wifiWebcamUrlInput?.value.trim();
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
            await fetch(url, { mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeoutId);
            localStorage.setItem(WIFI_WEBCAM_URL_KEY, url);
            alert('Connexion réussie ! La webcam WiFi est configurée.');
        } catch (error) {
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

    // --- Restauration des préférences ---
    const savedOcrEngine = localStorage.getItem(OCR_ENGINE_KEY);
    const savedTtsEngine = localStorage.getItem(TTS_ENGINE_KEY);
    const savedPiperSpeed = localStorage.getItem(PIPER_SPEED_KEY) || 1.15;

    if (savedOcrEngine && ocrEngineSelect) ocrEngineSelect.value = savedOcrEngine;
    if (savedTtsEngine && ttsEngineSelect) ttsEngineSelect.value = savedTtsEngine;
    if (piperSpeedSlider) piperSpeedSlider.value = savedPiperSpeed;
    updateSpeedDisplay(savedPiperSpeed);

    toggleModelSelector();
}
