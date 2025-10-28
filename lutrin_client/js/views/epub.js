import { getEpubById, updateEpub } from '../services/db_service.js';
import { runTTS } from '../services/processing.js';

/**
 * Affiche les détails d'un EPUB sur la page.
 * @param {object} epub - L'objet EPUB à afficher.
 */
function displayEpubDetails(epub) {
    const coverContainer = document.getElementById('epub-cover');
    const contentContainer = document.getElementById('epub-content');
    const infoContainer = document.getElementById('epub-info');
    const textContainer = document.getElementById('epub-text-panel');
    const loadingIndicator = document.getElementById('epub-loading');
    const audioPlayerBar = document.getElementById('epub-audio-player-bar');
    const playButton = document.getElementById('epub-play-audio-button');
    const audioPlayer = document.getElementById('epub-audio-player');

    // S'assurer que la propriété readingProgress existe pour les anciens EPUBs
    if (!epub.readingProgress) {
        epub.readingProgress = { lastChapterRead: 0 };
    }

    if (!coverContainer || !infoContainer || !loadingIndicator || !contentContainer || !textContainer || !audioPlayerBar || !playButton || !audioPlayer) return;

    // Masquer le chargement et afficher les conteneurs de détails
    loadingIndicator.classList.add('hidden');
    contentContainer.classList.remove('hidden');
    audioPlayerBar.classList.remove('hidden');

    // Afficher la couverture
    coverContainer.innerHTML = `
        <img src="${epub.cover_image || 'assets/placeholder-cover.png'}" alt="Couverture de ${epub.metadata.title}" class="w-full h-auto object-cover rounded-lg shadow-lg">
    `;

    // Afficher les informations
    infoContainer.innerHTML = `
        <h1 class="text-3xl font-bold text-gray-900 mb-2">${epub.metadata.title}</h1>
        <p class="text-xl text-gray-600 mb-4">par ${epub.metadata.authors.join(', ')}</p>
        
        ${epub.metadata.description ? `<p class="text-gray-700 mb-6">${epub.metadata.description}</p>` : ''}

        <div class="flex space-x-4">
            <button class="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                Lire le livre
            </button>
            <button class="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-400 transition-colors">
                Supprimer
            </button>
        </div>
    `;

    // Afficher le texte dans un textarea
    textContainer.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Texte du livre</h2>
        <textarea readonly class="w-full h-[60vh] md:h-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:ring-blue-500 focus:border-blue-500">${epub.text || 'Aucun texte disponible.'}</textarea>
    `;

    // --- Logique du lecteur audio ---

    const chapters = epub.text.split('\n\n');
    let isPlaying = false;
    let isStopped = true;
    let isFetching = false;
    let currentPlaybackIndex = epub.readingProgress?.lastChapterRead || 0;
    const audioQueue = new Map(); // Pour stocker les URL audio pré-chargées

    const updateButtonState = (state, text) => {
        if (!playButton) return;
        playButton.disabled = state === 'loading';
        const icon = playButton.querySelector('i');
        const span = playButton.querySelector('span');
        playButton.classList.toggle('animate-pulse', state === 'loading');

        if (state === 'loading') {
            icon.className = 'fas fa-spinner fa-spin mr-3';
        } else if (state === 'playing') {
            icon.className = 'fas fa-pause mr-3';
        } else { // 'paused', 'stopped', 'continue'
            icon.className = 'fas fa-play mr-3';
        }
        span.textContent = text;
    };

    const generateAudioForChapter = async (chapterIndex) => {
        if (isFetching || audioQueue.has(chapterIndex) || chapterIndex >= chapters.length) {
            return;
        }
        isFetching = true;
        try {
            const textToRead = chapters[chapterIndex];
            if (!textToRead || textToRead.trim() === '') {
                audioQueue.set(chapterIndex, 'silent'); // Marqueur pour les chapitres vides
                return;
            }
            const ttsEngine = document.getElementById('tts-engine-select')?.value || 'coqui';
            // 1. Obtenir l'URL de l'audio depuis le backend
            const ttsData = await runTTS(textToRead, ttsEngine);

            // 2. Télécharger l'audio et le stocker en tant que Blob
            const audioResponse = await fetch(ttsData.audio_url);
            if (!audioResponse.ok) {
                throw new Error(`Impossible de télécharger l'audio depuis ${ttsData.audio_url}`);
            }
            const audioBlob = await audioResponse.blob();

            // 3. Créer une URL locale pour ce Blob et la stocker dans notre file d'attente
            const localAudioUrl = URL.createObjectURL(audioBlob);
            audioQueue.set(chapterIndex, localAudioUrl);
            console.log(`Audio pour le chapitre ${chapterIndex} pré-chargé et stocké localement.`);
        } catch (error) {
            console.error(`Erreur lors de la génération de l'audio pour le chapitre ${chapterIndex}:`, error);
            // On pourrait vouloir gérer l'erreur, par exemple en essayant à nouveau plus tard.
        } finally {
            isFetching = false;
        }
    };

    const playChapter = async (chapterIndex) => {
        if (chapterIndex >= chapters.length) {
            console.log("Fin du livre atteinte.");
            updateButtonState('stopped', 'Rejouer');
            currentPlaybackIndex = 0;
            await updateEpub({ ...epub, readingProgress: { lastChapterRead: 0 } });
            isStopped = true;
            // Nettoyer les anciennes Blob URLs pour libérer la mémoire
            audioQueue.forEach(url => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
            isPlaying = false;
            return;
        }

        // Si l'audio n'est pas prêt, on l'attend
        if (!audioQueue.has(chapterIndex)) {
            updateButtonState('loading', 'Génération...');
            await generateAudioForChapter(chapterIndex);
        }

        const audioUrl = audioQueue.get(chapterIndex);

        if (audioUrl && audioUrl !== 'silent') {
            audioPlayer.src = audioUrl;
            audioPlayer.play();
        } else {
            // Si le chapitre est vide ou silencieux, on passe directement au suivant
            console.log(`Chapitre ${chapterIndex} est vide, passage au suivant.`);
            currentPlaybackIndex++;
            playChapter(currentPlaybackIndex);
        }
    };

    const handlePlayClick = async () => {
        if (isPlaying) {
            audioPlayer.pause();
        } else {
            isStopped = false;
            if (audioPlayer.src && audioPlayer.currentTime > 0) {
                audioPlayer.play();
            } else {
                playChapter(currentPlaybackIndex);
            }
        }
    };

    playButton.addEventListener('click', handlePlayClick);

    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updateButtonState('playing', 'Pause');
        // Pré-charger le chapitre suivant pendant que celui-ci joue
        generateAudioForChapter(currentPlaybackIndex + 1);
    });

    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        if (!isStopped) {
            updateButtonState('paused', 'Écouter');
        }
    });

    audioPlayer.addEventListener('ended', async () => {
        // Sauvegarder la progression du chapitre qui vient de se terminer
        epub.readingProgress.lastChapterRead = currentPlaybackIndex;
        await updateEpub(epub);
        console.log(`Progression sauvegardée au chapitre ${currentPlaybackIndex}`);

        currentPlaybackIndex++;
        if (!isStopped) {
            playChapter(currentPlaybackIndex);
        }
    });

    // Nettoyage quand on quitte la vue (le routeur ne le fait pas automatiquement)
    // On peut améliorer ça avec un système de "démontage" de vue dans le routeur.
    // Pour l'instant, on s'assure que l'audio s'arrête si on navigue ailleurs.
    // Et on nettoie les Blob URLs pour éviter les fuites de mémoire.
    window.addEventListener('beforeunload', () => {
        audioQueue.forEach(url => URL.revokeObjectURL(url));
    });
}

/**
 * Initialise la vue de détail de l'EPUB.
 */
export async function initEpubDetailView(urlParams) {
    const epubId = parseInt(urlParams.get('id'), 10);

    const errorContainer = document.getElementById('epub-error-container');

    if (!epubId) {
        if (errorContainer) errorContainer.innerHTML = '<p class="text-red-500">Erreur : ID du livre non spécifié.</p>';
        return;
    }

    try {
        const epub = await getEpubById(epubId);
        if (epub) displayEpubDetails(epub);
    } catch (error) {
        console.error("Erreur lors de la récupération de l'EPUB:", error);
        if (errorContainer) errorContainer.innerHTML = '<p class="text-red-500">Impossible de charger les détails de ce livre.</p>';
    }
}