import { getEpubById, updateEpub, deleteEpubFromDB } from '../services/db_service.js';
import { runTTS } from '../services/processing.js';
import { navigateTo } from '../router.js';

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
    const prevChapterButton = document.getElementById('epub-prev-chapter-button');
    const prev10ChapterButton = document.getElementById('epub-prev-10-chapter-button');
    const nextChapterButton = document.getElementById('epub-next-chapter-button');
    const next10ChapterButton = document.getElementById('epub-next-10-chapter-button');
    const chapterSlider = document.getElementById('epub-chapter-slider');
    const chapterDisplay = document.getElementById('epub-chapter-display');
    const audioPlayer = document.getElementById('epub-audio-player');

    // S'assurer que la propriété readingProgress existe pour les anciens EPUBs
    if (!epub.readingProgress) {
        epub.readingProgress = { lastChapterRead: 0 };
    }

    if (!coverContainer || !infoContainer || !loadingIndicator || !contentContainer || !textContainer || !audioPlayerBar || !playButton || !prevChapterButton || !nextChapterButton || !prev10ChapterButton || !next10ChapterButton || !chapterSlider || !chapterDisplay || !audioPlayer) return;

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
        
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 mb-4">
            ${epub.metadata.style ? `
                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">${epub.metadata.style}</span>
            ` : ''}
            ${epub.metadata.series ? `
                <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    ${epub.metadata.series}
                    ${epub.metadata.series_number ? ` - Vol. ${epub.metadata.series_number}` : ''}
                </span>
            ` : ''}
        </div>

        ${epub.metadata.description ? `<p class="text-gray-700 mb-6">${epub.metadata.description}</p>` : ''}

        <div class="flex space-x-4">
            <button id="delete-epub-button" class="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-400 transition-colors">
                Supprimer
            </button>
        </div>
    `;

    // --- Logique de suppression ---
    const deleteButton = document.getElementById('delete-epub-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
            const confirmation = window.confirm(`Êtes-vous sûr de vouloir supprimer "${epub.metadata.title}" ? Cette action est irréversible.`);
            if (confirmation) {
                console.log(`Suppression du livre avec l'ID: ${epub.id}`);
                await deleteEpubFromDB(epub.id);
                navigateTo('/epubs');
            }
        });
    }

    // --- Logique du lecteur audio ---

    const chapters = epub.text.split('\n\n').filter(chapter => chapter.trim() !== '');
    let isPlaying = false;
    let isStopped = true;
    let isFetching = false;
    let currentPlaybackIndex = epub.readingProgress?.lastChapterRead || 0;
    const audioQueue = new Map(); // Pour stocker les URL audio pré-chargées

    // --- Affichage du texte par chapitres ---
    textContainer.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Texte du livre</h2>
        <div id="epub-text-content" class="w-full h-[60vh] md:h-full bg-gray-50 border border-gray-300 rounded-lg p-4 text-gray-800 focus:ring-blue-500 focus:border-blue-500 overflow-y-auto">
            ${chapters.map((chapter, index) => `
                <p id="chapter-${index}" class="mb-4 transition-colors duration-300 p-2 rounded-md">
                    ${chapter.replace(/\n/g, '<br>')}
                </p>
            `).join('') || '<p>Aucun texte disponible.</p>'}
        </div>
    `;

    const highlightChapter = (chapterIndex) => {
        // Implémentation du surlignage et du scroll
    };

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
            console.log(`${chapterIndex} = ${textToRead}`);

            if (!textToRead || textToRead.trim() === '') {
                audioQueue.set(chapterIndex, 'silent'); // Marqueur pour les chapitres vides
                return;
            }
            const ttsEngine = document.getElementById('tts-engine-select')?.value || 'coqui';

            // 1. Obtenir l'URL de l'audio depuis le backend
            const ttsResult = await runTTS(textToRead, ttsEngine);

            // Gérer le cas où le TTS considère le texte comme vide (même si le client ne le pensait pas)
            if (!ttsResult.success && ttsResult.message && ttsResult.message.includes("Le texte fourni est vide")) {
                audioQueue.set(chapterIndex, 'silent');
                return;
            }

            // 2. Télécharger l'audio et le stocker en tant que Blob
            const audioResponse = await fetch(ttsResult.audio_url);
            if (!audioResponse.ok) {
                throw new Error(`Impossible de télécharger l'audio depuis ${ttsResult.audio_url}`);
            }
            const audioBlob = await audioResponse.blob();

            // 3. Créer une URL locale pour ce Blob et la stocker dans notre file d'attente
            const localAudioUrl = URL.createObjectURL(audioBlob);
            audioQueue.set(chapterIndex, localAudioUrl);
            console.log(`Audio pour le chapitre ${chapterIndex} pré-chargé et stocké localement.`);
        } catch (error) {
            console.error(`Erreur lors de la génération de l'audio pour le chapitre ${chapterIndex}:`, error);
            // Marquer le chapitre comme ayant échoué pour qu'on puisse réessayer plus tard.
            audioQueue.set(chapterIndex, 'silent'); // On le traite comme un chapitre silencieux pour ne pas bloquer la lecture.
        } finally {
            isFetching = false;
        }
    };

    const highlightAndScrollToChapter = (chapterIndex) => {
        const textContentDiv = document.getElementById('epub-text-content');
        if (!textContentDiv) return;

        // Supprimer le surlignage précédent
        const previousHighlight = textContentDiv.querySelector('.bg-yellow-200');
        if (previousHighlight) {
            previousHighlight.classList.remove('bg-yellow-200');
        }

        // Ajouter le nouveau surlignage et faire défiler
        const chapterElement = document.getElementById(`chapter-${chapterIndex}`);
        if (chapterElement) {
            chapterElement.classList.add('bg-yellow-200');
            chapterElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const updateSliderAndDisplay = (index) => {
        if (chapterSlider) {
            chapterSlider.value = index;
        }
        if (chapterDisplay) {
            // Ajout de +1 pour un affichage plus naturel (Chapitre 1 au lieu de 0)
            chapterDisplay.textContent = `Chapitre ${index + 1} / ${chapters.length}`;
        }
    };

    const playChapter = async (chapterIndex) => {
        if (chapterIndex >= chapters.length) {
            console.log("Fin du livre atteinte.");
            updateButtonState('stopped', 'Terminé');
            currentPlaybackIndex = chapters.length; // On se positionne à la fin
            await updateEpub({ ...epub, readingProgress: { lastChapterRead: chapters.length } });
            isStopped = true;
            // Nettoyer les anciennes Blob URLs pour libérer la mémoire
            audioQueue.forEach(url => { //
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
            isPlaying = false;
            return;
        }

        // Surligner le chapitre et faire défiler
        highlightAndScrollToChapter(chapterIndex);
        updateSliderAndDisplay(chapterIndex);

        // Sauvegarder la progression dès qu'on commence à jouer un chapitre
        epub.readingProgress.lastChapterRead = chapterIndex;
        await updateEpub({ ...epub }); // On envoie une copie pour être sûr
        console.log(`Progression sauvegardée au début du chapitre ${chapterIndex}`);

        // Si l'audio n'est pas prêt, on le génère et on attend qu'il le soit.
        if (!audioQueue.has(chapterIndex)) {
            updateButtonState('loading', 'Génération...');
            await generateAudioForChapter(chapterIndex);
        }

        const audioUrl = audioQueue.get(chapterIndex); // On récupère l'URL maintenant qu'on est sûr qu'elle existe.

        if (audioUrl && audioUrl !== 'silent') {
            audioPlayer.src = audioUrl;
            audioPlayer.play();
            return true; // Lecture démarrée avec succès
        } else {
            // Si le chapitre est vide ou silencieux, on passe directement au suivant
            console.log(`Chapitre ${chapterIndex} est vide, passage au suivant.`);
            return false; // Indique que le chapitre a été sauté
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

    const goToNextChapter = async () => {
        if (currentPlaybackIndex < chapters.length - 1) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            isPlaying = false;
            isStopped = true; // On considère que la lecture est arrêtée
            currentPlaybackIndex++;

            // Sauvegarder la nouvelle position
            epub.readingProgress.lastChapterRead = currentPlaybackIndex;
            await updateEpub({ ...epub });

            highlightAndScrollToChapter(currentPlaybackIndex);
            updateButtonState('paused', 'Écouter');
            updateSliderAndDisplay(currentPlaybackIndex);
            updateNavButtonsState();
        }
    };

    const goToPrevChapter = async () => {
        if (currentPlaybackIndex > 0) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            isPlaying = false;
            isStopped = true; // On considère que la lecture est arrêtée
            currentPlaybackIndex--;

            // Sauvegarder la nouvelle position
            epub.readingProgress.lastChapterRead = currentPlaybackIndex;
            await updateEpub({ ...epub });

            highlightAndScrollToChapter(currentPlaybackIndex);
            updateButtonState('paused', 'Écouter');
            updateSliderAndDisplay(currentPlaybackIndex);
            updateNavButtonsState();
        }
    };

    const jumpChaptersBackward = async () => {
        if (currentPlaybackIndex > 0) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            isPlaying = false;
            isStopped = true;

            currentPlaybackIndex = Math.max(0, currentPlaybackIndex - 10);

            // Sauvegarder la nouvelle position
            epub.readingProgress.lastChapterRead = currentPlaybackIndex;
            await updateEpub({ ...epub });

            highlightAndScrollToChapter(currentPlaybackIndex);
            updateButtonState('paused', 'Écouter');
            updateSliderAndDisplay(currentPlaybackIndex);
            updateNavButtonsState();
        }
    };

    const jumpChaptersForward = async () => {
        if (currentPlaybackIndex < chapters.length - 1) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            isPlaying = false;
            isStopped = true;

            currentPlaybackIndex = Math.min(chapters.length - 1, currentPlaybackIndex + 10);

            // Sauvegarder la nouvelle position
            epub.readingProgress.lastChapterRead = currentPlaybackIndex;
            await updateEpub({ ...epub });

            highlightAndScrollToChapter(currentPlaybackIndex);
            updateButtonState('paused', 'Écouter');
            updateSliderAndDisplay(currentPlaybackIndex);
            updateNavButtonsState();
        }
    };

    const updateNavButtonsState = () => {
        if (!prevChapterButton || !nextChapterButton || !prev10ChapterButton || !next10ChapterButton) return;
        prevChapterButton.disabled = currentPlaybackIndex <= 0;
        prev10ChapterButton.disabled = currentPlaybackIndex <= 0;
        nextChapterButton.disabled = currentPlaybackIndex >= chapters.length - 1;
        next10ChapterButton.disabled = currentPlaybackIndex >= chapters.length - 1;
    };

    const handleSliderChange = async (event) => {
        const newIndex = parseInt(event.target.value, 10);
        if (newIndex !== currentPlaybackIndex) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            isPlaying = false;
            isStopped = true;

            currentPlaybackIndex = newIndex;

            // Sauvegarder la nouvelle position
            epub.readingProgress.lastChapterRead = currentPlaybackIndex;
            await updateEpub({ ...epub });

            highlightAndScrollToChapter(currentPlaybackIndex);
            updateButtonState('paused', 'Écouter');
            updateSliderAndDisplay(currentPlaybackIndex);
            updateNavButtonsState();
        }
    };

    playButton.addEventListener('click', handlePlayClick);
    nextChapterButton.addEventListener('click', goToNextChapter);
    prevChapterButton.addEventListener('click', goToPrevChapter);
    next10ChapterButton.addEventListener('click', jumpChaptersForward);
    prev10ChapterButton.addEventListener('click', jumpChaptersBackward);
    chapterSlider.addEventListener('input', (e) => updateSliderAndDisplay(parseInt(e.target.value, 10)));
    chapterSlider.addEventListener('change', handleSliderChange);

    audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updateButtonState('playing', 'Pause');
        updateNavButtonsState();
        // Pré-charger le chapitre suivant pendant que celui-ci joue
        generateAudioForChapter(currentPlaybackIndex + 1);
    });

    audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        if (!isStopped) {
            updateButtonState('paused', 'Écouter');
            updateNavButtonsState();
        }
    });

    audioPlayer.addEventListener('ended', async () => {
        currentPlaybackIndex++;
        let chapterPlayed = false;
        while (!chapterPlayed && currentPlaybackIndex < chapters.length && !isStopped) {
            updateNavButtonsState();
            chapterPlayed = await playChapter(currentPlaybackIndex);
            if (!chapterPlayed) {
                currentPlaybackIndex++; // Si le chapitre a été sauté, on passe au suivant
            }
        }
    });

    // Initialisation du slider
    chapterSlider.max = chapters.length > 0 ? chapters.length - 1 : 0;

    // Surligner le chapitre initial et mettre à jour les boutons au chargement
    highlightAndScrollToChapter(currentPlaybackIndex);
    updateSliderAndDisplay(currentPlaybackIndex);
    updateNavButtonsState();

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
        if (epub) {
            displayEpubDetails(epub);
            // Retourne la fonction de nettoyage pour que le routeur puisse l'utiliser
            return () => {
                console.log("Nettoyage de la vue EPUB...");
                const audioPlayer = document.getElementById('epub-audio-player');
                if (audioPlayer) {
                    audioPlayer.pause();
                    audioPlayer.removeAttribute('src');
                }
                // Note: La gestion de la file d'attente (audioQueue) est interne à displayEpubDetails
                // et sera perdue avec la navigation, ce qui est acceptable.
                // Les Blob URLs seront éventuellement nettoyées par le garbage collector du navigateur.
            };
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de l'EPUB:", error);
        if (errorContainer) errorContainer.innerHTML = '<p class="text-red-500">Impossible de charger les détails de ce livre.</p>';
    }
    return null; // Pas de fonction de nettoyage si la vue n'a pas pu être initialisée
}