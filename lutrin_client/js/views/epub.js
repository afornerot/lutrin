import { getEpubById, updateEpub, deleteEpubFromDB } from '../services/db_service.js';
import { post } from '../api.js';
import { getAuthUserRole } from '../auth.js';
import { runTTS } from '../services/processing.js';
import { startApiCheck, stopApiCheck } from '../services/apiStatus.js';
import { navigateTo } from '../router.js';

/**
 * Affiche les détails d'un EPUB sur la page.
 * @param {object} epub - L'objet EPUB à afficher.
 */
function displayEpub(epub) {
    const coverContainer = document.getElementById('epub-cover');
    const contentContainer = document.getElementById('epub-content');
    const infoContainer = document.getElementById('epub-info');
    const topBarContainer = document.getElementById('epub-top-bar');
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

    if (!coverContainer || !infoContainer || !topBarContainer || !loadingIndicator || !contentContainer || !textContainer || !audioPlayerBar || !playButton || !prevChapterButton || !nextChapterButton || !prev10ChapterButton || !next10ChapterButton || !chapterSlider || !chapterDisplay || !audioPlayer) return;

    // Masquer le chargement et afficher les conteneurs de détails
    loadingIndicator.classList.add('hidden');
    contentContainer.classList.remove('hidden');
    topBarContainer.classList.remove('hidden');
    audioPlayerBar.classList.remove('hidden');

    // Afficher la couverture
    coverContainer.innerHTML = `
        <div id="epub-cover-wrapper" class="${!epub.cover_image ? 'cover-upload' : ''}">
            <img src="${epub.cover_image || 'assets/placeholder-cover.png'}" alt="Couverture de ${epub.metadata.title}">
            ${!epub.cover_image ? `
                <div class="cover-upload-overlay">
                    <span>Cliquer pour ajouter une couverture</span>
                </div>
            ` : ''}
        </div>
        <input type="file" id="cover-upload-input" class="hidden" accept="image/png, image/jpeg, image/webp">
    `;

    // --- Barre supérieure avec les actions ---
    topBarContainer.innerHTML = `
        <div id="top-bar-title-wrapper">
            <h1 class="top-bar-title" title="${epub.metadata.title}">${epub.metadata.title}</h1>
            <p class="top-bar-author">par ${epub.metadata.authors.join(', ')}</p>
        </div>
        ${getAuthUserRole() === 'ADMIN' ? `
            <button id="add-to-library-button" title="Ajouter à la bibliothèque centrale" class="btn-icon">
                <i class="fas fa-server"></i>
            </button>
        ` : ''}
        <div class="top-bar-actions">
            <button id="mark-as-read-button" title="Marquer comme lu" class="btn-icon">
                <i class="fas fa-check-double"></i>
            </button>
            <button id="mark-as-unread-button" title="Marquer comme non lu" class="btn-icon">
                <i class="fas fa-book"></i>
            </button>
            <button id="delete-epub-button" title="Supprimer le livre" class="btn-icon">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    // --- Logique de scroll vers la couverture ---
    const topBarTitleWrapper = document.getElementById('top-bar-title-wrapper');
    if (topBarTitleWrapper) {
        topBarTitleWrapper.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Afficher les informations
    infoContainer.innerHTML = `
        <div class="epub-meta-tags">
            <span id="edit-authors-trigger" class="tag tag-author ${epub.metadata.authors && epub.metadata.authors.length > 0 ? '' : 'tag-empty'}">${epub.metadata.authors.join(', ') || 'Auteur indéterminé'}</span>
            <span id="edit-style-trigger" class="tag tag-style">${epub.metadata.style || 'Genre indéterminé'}</span>
            <span id="edit-series-trigger" class="tag tag-series">${(epub.metadata.series ? `${epub.metadata.series}${epub.metadata.series_number ? ` - Vol. ${epub.metadata.series_number}` : ''}` : 'Série indéterminée')}</span>
        </div>
        ${epub.metadata.description ? `<p id="epub-description">${epub.metadata.description}</p>` : ''}
    `;

    infoContainer.insertAdjacentHTML('afterend', '<audio id="epub-description-audio-player" class="hidden"></audio>');

    // --- Logique d'upload de la couverture ---
    const coverWrapper = document.getElementById('epub-cover-wrapper');
    const coverUploadInput = document.getElementById('cover-upload-input');

    if (coverWrapper && coverUploadInput) {
        coverWrapper.addEventListener('click', () => {
            // On ne déclenche l'upload que s'il n'y a pas déjà une couverture
            if (!epub.cover_image) {
                coverUploadInput.click();
            }
        });

        coverUploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const newCoverImage = e.target.result;

                // Mettre à jour l'objet en mémoire et dans la DB
                epub.cover_image = newCoverImage;
                await updateEpub(epub);

                // Rafraîchir l'affichage de la couverture
                displayEpub(epub);
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Logique pour marquer comme lu/non lu ---
    const markAsReadButton = document.getElementById('mark-as-read-button');
    const markAsUnreadButton = document.getElementById('mark-as-unread-button');

    if (markAsReadButton) {
        markAsReadButton.addEventListener('click', async () => {
            const totalChapters = epub.totalChapters || chapters.length;
            if (epub.readingProgress.lastChapterRead !== totalChapters) {
                epub.readingProgress.lastChapterRead = totalChapters;
                await updateEpub(epub);
                console.log("Livre marqué comme lu.");
                // Rafraîchir l'état de la vue
                currentPlaybackIndex = totalChapters;
                highlightAndScrollToChapter(currentPlaybackIndex);
                updateSliderAndDisplay(currentPlaybackIndex);
                updateNavButtonsState();
                updateButtonState('stopped', 'Terminé');
            }
        });
    }

    if (markAsUnreadButton) {
        markAsUnreadButton.addEventListener('click', async () => {
            if (epub.readingProgress.lastChapterRead !== 0) {
                epub.readingProgress.lastChapterRead = 0;
                await updateEpub(epub);
                console.log("Livre marqué comme non lu.");
                // Rafraîchir l'état de la vue
                currentPlaybackIndex = 0;
                audioPlayer.pause();
                audioPlayer.removeAttribute('src');
                isPlaying = false;
                isStopped = true;
                highlightAndScrollToChapter(currentPlaybackIndex);
                updateSliderAndDisplay(currentPlaybackIndex);
                updateNavButtonsState();
                updateButtonState('paused', 'Écouter');
            }
        });
    }

    // --- Logique pour ajouter à la bibliothèque centrale (Admin) ---
    const addToLibraryButton = document.getElementById('add-to-library-button');
    if (addToLibraryButton) {
        addToLibraryButton.addEventListener('click', async () => {
            const confirmation = window.confirm(`Voulez-vous ajouter "${epub.metadata.title}" à la bibliothèque centrale du serveur ?`);
            if (confirmation) {
                try {
                    // On envoie l'objet epub complet, qui contient metadata, cover_image, et text.
                    const result = await post('/library/add-from-json', epub);
                    alert(`Livre ajouté avec succès à la bibliothèque centrale (ID: ${result.id})`);
                    addToLibraryButton.disabled = true; // Désactiver le bouton après succès
                    addToLibraryButton.classList.add('text-green-500', 'cursor-not-allowed');
                    addToLibraryButton.title = "Déjà dans la bibliothèque centrale";
                } catch (error) {
                    console.error("Erreur lors de l'ajout à la bibliothèque centrale:", error);
                    alert(`Erreur: ${error.message}`);
                }
            }
        });
    }

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

    // --- Logique de l'overlay de modification ---
    const editStyleOverlay = document.getElementById('edit-style-overlay');
    const editStyleTrigger = document.getElementById('edit-style-trigger');
    const editStyleInput = document.getElementById('edit-style-input');
    const saveStyleButton = document.getElementById('save-edit-style');
    const cancelStyleButton = document.getElementById('cancel-edit-style');
    const editSeriesOverlay = document.getElementById('edit-series-overlay');
    const editSeriesTrigger = document.getElementById('edit-series-trigger');
    const editSeriesNameInput = document.getElementById('edit-series-name-input');
    const editSeriesNumberInput = document.getElementById('edit-series-number-input');
    const saveSeriesButton = document.getElementById('save-edit-series');
    const cancelSeriesButton = document.getElementById('cancel-edit-series');
    const editAuthorsOverlay = document.getElementById('edit-authors-overlay');
    const editAuthorsTrigger = document.getElementById('edit-authors-trigger');
    const editAuthorsInput = document.getElementById('edit-authors-input');
    const saveAuthorsButton = document.getElementById('save-edit-authors');
    const cancelAuthorsButton = document.getElementById('cancel-edit-authors');


    const showEditOverlay = () => {
        if (editStyleInput) editStyleInput.value = epub.metadata.style || '';
        if (editStyleOverlay) editStyleOverlay.classList.remove('hidden');
        setTimeout(() => editStyleInput?.focus(), 50); // Met le focus sur le champ
    };

    const hideEditOverlay = () => {
        if (editStyleOverlay) editStyleOverlay.classList.add('hidden');
    };

    const saveStyleChange = async () => {
        const newStyle = editStyleInput.value.trim();
        if (newStyle !== (epub.metadata.style || '')) {
            // Mettre à jour l'objet epub en mémoire
            epub.metadata.style = newStyle;
            // Sauvegarder dans la base de données
            await updateEpub(epub);
            // Mettre à jour l'affichage du badge
            if (editStyleTrigger) {
                editStyleTrigger.textContent = newStyle;
            }
        }
        hideEditOverlay();
    };

    editStyleTrigger?.addEventListener('click', showEditOverlay);
    cancelStyleButton?.addEventListener('click', hideEditOverlay);
    saveStyleButton?.addEventListener('click', saveStyleChange);
    editStyleOverlay?.addEventListener('click', (e) => { if (e.target === editStyleOverlay) hideEditOverlay(); }); // Clic sur le fond
    editStyleInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Empêche le comportement par défaut du formulaire
            saveStyleChange();
        }
    });

    const showEditSeriesOverlay = () => {
        if (editSeriesNameInput) editSeriesNameInput.value = epub.metadata.series || '';
        if (editSeriesNumberInput) editSeriesNumberInput.value = epub.metadata.series_number || '';
        if (editSeriesOverlay) editSeriesOverlay.classList.remove('hidden');
        setTimeout(() => editSeriesNameInput?.focus(), 50); // Met le focus sur le champ
    };

    const hideEditSeriesOverlay = () => {
        if (editSeriesOverlay) editSeriesOverlay.classList.add('hidden');
    };

    const saveSeriesChange = async () => {
        const newSeriesName = editSeriesNameInput.value.trim();
        const newSeriesNumber = editSeriesNumberInput.value ? parseInt(editSeriesNumberInput.value, 10) : null;

        const hasChanged = newSeriesName !== (epub.metadata.series || '') || newSeriesNumber !== (epub.metadata.series_number || null);

        if (hasChanged) {
            // Mettre à jour l'objet epub en mémoire
            epub.metadata.series = newSeriesName;
            epub.metadata.series_number = newSeriesNumber;
            // Sauvegarder dans la base de données
            await updateEpub(epub);
            // Mettre à jour l'affichage du badge
            if (editSeriesTrigger) {
                editSeriesTrigger.textContent = `${newSeriesName}${newSeriesNumber ? ` - Vol. ${newSeriesNumber}` : ''}`;
            }
        }
        hideEditSeriesOverlay();
    };

    editSeriesTrigger?.addEventListener('click', showEditSeriesOverlay);
    cancelSeriesButton?.addEventListener('click', hideEditSeriesOverlay);
    saveSeriesButton?.addEventListener('click', saveSeriesChange);
    editSeriesOverlay?.addEventListener('click', (e) => { if (e.target === editSeriesOverlay) hideEditSeriesOverlay(); });
    [editSeriesNameInput, editSeriesNumberInput].forEach(input => {
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveSeriesChange();
            }
        });
    });

    const showEditAuthorsOverlay = () => {
        if (editAuthorsInput) editAuthorsInput.value = epub.metadata.authors.join(', ');
        if (editAuthorsOverlay) editAuthorsOverlay.classList.remove('hidden');
        setTimeout(() => editAuthorsInput?.focus(), 50); // Met le focus sur le champ
    };

    const hideEditAuthorsOverlay = () => {
        if (editAuthorsOverlay) editAuthorsOverlay.classList.add('hidden');
    };

    const saveAuthorsChange = async () => {
        // On transforme la chaîne de caractères en tableau, en nettoyant les espaces et en filtrant les entrées vides.
        const newAuthors = editAuthorsInput.value.split(',').map(author => author.trim()).filter(Boolean);

        // On vérifie si le tableau a réellement changé pour éviter une mise à jour inutile.
        const hasChanged = JSON.stringify(newAuthors) !== JSON.stringify(epub.metadata.authors);

        if (hasChanged) {
            // Mettre à jour l'objet epub en mémoire
            epub.metadata.authors = newAuthors;
            // Sauvegarder dans la base de données
            await updateEpub(epub);
            // Mettre à jour l'affichage du badge et de la barre supérieure
            if (editAuthorsTrigger) {
                editAuthorsTrigger.textContent = newAuthors.join(', ') || 'Auteur indéterminé';
            }
            const topBarAuthorElement = topBarContainer.querySelector('p');
            if (topBarAuthorElement) {
                topBarAuthorElement.textContent = `par ${newAuthors.join(', ')}`;
            }
        }
        hideEditAuthorsOverlay();
    };

    editAuthorsTrigger?.addEventListener('click', showEditAuthorsOverlay);
    cancelAuthorsButton?.addEventListener('click', hideEditAuthorsOverlay);
    saveAuthorsButton?.addEventListener('click', saveAuthorsChange);
    editAuthorsOverlay?.addEventListener('click', (e) => { if (e.target === editAuthorsOverlay) hideEditAuthorsOverlay(); });
    editAuthorsInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveAuthorsChange();
        }
    });

    // --- Logique TTS pour la description ---
    const descriptionElement = document.getElementById('epub-description');
    const descriptionAudioPlayer = document.getElementById('epub-description-audio-player');
    let isDescriptionPlaying = false;

    if (descriptionElement && descriptionAudioPlayer) {
        descriptionElement.addEventListener('click', async () => {
            if (isDescriptionPlaying) {
                descriptionAudioPlayer.pause();
                descriptionAudioPlayer.currentTime = 0;
                isDescriptionPlaying = false;
                descriptionElement.querySelector('i')?.remove(); // Enlève l'icône
                return;
            }

            const descriptionText = epub.metadata.description;
            if (!descriptionText) return;

            // Afficher une icône de chargement
            const loadingIcon = document.createElement('i');
            loadingIcon.className = 'fas fa-spinner fa-spin loading-icon';
            descriptionElement.appendChild(loadingIcon);

            try {
                stopApiCheck(); // On suspend la vérification pendant le TTS
                isDescriptionPlaying = true;
                const ttsResult = await runTTS(descriptionText);


                // Remplacer l'icône de chargement par une icône de lecture
                loadingIcon.className = 'fas fa-volume-up loading-icon';

                descriptionAudioPlayer.src = ttsResult.audio_url;
                descriptionAudioPlayer.play();

                descriptionAudioPlayer.onended = () => {
                    isDescriptionPlaying = false;
                    descriptionElement.querySelector('i')?.remove();
                };

            } catch (error) {
                console.error("Erreur TTS pour la description:", error);
                isDescriptionPlaying = false;
                descriptionElement.querySelector('i')?.remove();
                alert("Impossible de générer l'audio pour la description.");
            } finally {
                startApiCheck(); // On réactive la vérification
            }
        });
    }



    // --- Logique du lecteur audio ---

    const chapters = epub.text.split('\n\n').filter(chapter => chapter.trim() !== '');
    let isPlaying = false;
    let isStopped = true;
    let currentPlaybackIndex = epub.readingProgress?.lastChapterRead || 0;
    const audioQueue = new Map(); // Pour stocker les URL audio pré-chargées
    const fetchingPromises = new Map(); // Pour suivre les générations audio en cours

    // --- Affichage du texte par chapitres ---
    textContainer.innerHTML = `
        <div id="epub-text-content">
            ${chapters.map((chapter, index) => `
                <p id="chapter-${index}" class="chapter-text">
                    ${chapter.replace(/\n/g, '<br>')}
                </p>
            `).join('') || '<p>Aucun texte disponible.</p>'}
        </div>
    `;

    const updateButtonState = (state, text) => {
        if (!playButton) return;
        playButton.disabled = state === 'loading';
        const icon = playButton.querySelector('i');
        const span = playButton.querySelector('span');
        playButton.classList.toggle('btn-loading', state === 'loading');

        if (state === 'loading') {
            icon.className = 'fas fa-spinner fa-spin';
        } else if (state === 'playing') {
            icon.className = 'fas fa-pause';
        } else { // 'paused', 'stopped', 'continue'
            icon.className = 'fas fa-play';
        }
        span.textContent = text;
    };

    const generateAudioForChapter = async (chapterIndex) => {
        // Si l'audio existe déjà, est en cours de génération, ou si l'index est invalide, on ne fait rien.
        if (audioQueue.has(chapterIndex) || fetchingPromises.has(chapterIndex) || chapterIndex >= chapters.length) {
            return;
        }

        // Crée une promesse pour cette génération et la stocke
        const generationPromise = (async () => {
            try {
                const textToRead = chapters[chapterIndex];
                console.log(`Début de la génération pour le chapitre ${chapterIndex}`);

                try {
                    const textToRead = chapters[chapterIndex];
                    console.log(`${chapterIndex} = ${textToRead}`);

                    if (!textToRead || textToRead.trim() === '') {
                        audioQueue.set(chapterIndex, 'silent'); // Marqueur pour les chapitres vides
                        return;
                    }

                    // On suspend la vérification pendant le TTS
                    stopApiCheck();

                    // Obtenir l'URL de l'audio depuis le backend
                    const ttsResult = await runTTS(textToRead);

                    // Gérer le cas où le TTS considère le texte comme vide (même si le client ne le pensait pas)
                    if (ttsResult.error && ttsResult.details && ttsResult.details.includes("Le texte fourni est vide")) {
                        audioQueue.set(chapterIndex, 'silent');
                        return;
                    }

                    // Télécharger l'audio et le stocker en tant que Blob
                    const audioResponse = await fetch(ttsResult.audio_url);
                    if (!audioResponse.ok) {
                        throw new Error(`Impossible de télécharger l'audio depuis ${ttsResult.audio_url}`);
                    }
                    const audioBlob = await audioResponse.blob();

                    // Créer une URL locale pour ce Blob et la stocker dans notre file d'attente
                    const localAudioUrl = URL.createObjectURL(audioBlob);
                    audioQueue.set(chapterIndex, localAudioUrl);
                    console.log(`Audio pour le chapitre ${chapterIndex} pré-chargé et stocké localement.`);
                } catch (error) {
                    console.error(`Erreur lors de la génération de l'audio pour le chapitre ${chapterIndex}:`, error);
                    // Marquer le chapitre comme ayant échoué pour qu'on puisse réessayer plus tard.
                    audioQueue.set(chapterIndex, 'error'); // On le traite comme une erreur pour ne pas bloquer la lecture.
                } finally {
                    startApiCheck(); // On réactive la vérification
                }
            } finally {
                // Une fois la génération terminée (succès ou échec), on retire la promesse de la map.
                fetchingPromises.delete(chapterIndex);
                console.log(`Génération terminée pour le chapitre ${chapterIndex}`);
            }
        })();
        fetchingPromises.set(chapterIndex, generationPromise);
    };

    const highlightAndScrollToChapter = (chapterIndex) => {
        const textContentDiv = document.getElementById('epub-text-content');
        if (!textContentDiv) return;

        // Supprimer le surlignage et la transition de l'élément précédent
        const previousHighlight = textContentDiv.querySelector('.chapter-highlight');
        if (previousHighlight) {
            previousHighlight.classList.remove('chapter-highlight');
        }

        // Ajouter le surlignage, puis faire défiler
        const chapterElement = document.getElementById(`chapter-${chapterIndex}`);
        if (chapterElement) {
            chapterElement.classList.add('chapter-highlight');
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
        updateNavButtonsState();

        // Sauvegarder la progression dès qu'on commence à jouer un chapitre
        epub.readingProgress.lastChapterRead = chapterIndex;
        await updateEpub({ ...epub }); // On envoie une copie pour être sûr
        console.log(`Progression sauvegardée au début du chapitre ${chapterIndex}`);

        // Si l'audio n'est pas prêt, on le génère et on attend qu'il le soit.
        if (!audioQueue.has(chapterIndex)) {
            updateButtonState('loading', 'Génération...');
            // Si une génération n'est pas déjà en cours, on la lance.
            if (!fetchingPromises.has(chapterIndex)) {
                generateAudioForChapter(chapterIndex);
            }
            // Dans tous les cas (qu'on vienne de la lancer ou qu'elle était déjà en cours), on attend qu'elle se termine.
            if (fetchingPromises.has(chapterIndex)) {
                await fetchingPromises.get(chapterIndex);
            }
        }

        const audioUrl = audioQueue.get(chapterIndex); // On récupère l'URL maintenant qu'on est sûr qu'elle existe.

        if (audioUrl && audioUrl !== 'silent' && audioUrl !== 'error') {
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
        // On continue tant qu'on n'a pas joué un chapitre, qu'on n'est pas à la fin du livre et que l'utilisateur n'a pas stoppé la lecture.
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
export async function initEpubView(urlParams) {
    const epubId = parseInt(urlParams.get('id'), 10);

    const errorContainer = document.getElementById('epub-error-container');

    if (!epubId) {
        if (errorContainer) errorContainer.innerHTML = '<p class="error">Erreur : ID du livre non spécifié.</p>';
        return;
    }

    try {
        const epub = await getEpubById(epubId);
        if (epub) {
            displayEpub(epub);

            // Retourne la fonction de nettoyage pour que le routeur puisse l'utiliser
            return () => {
                console.log("Nettoyage de la vue EPUB...");
                const audioPlayer = document.getElementById('epub-audio-player');
                if (audioPlayer) {
                    audioPlayer.pause();
                    audioPlayer.removeAttribute('src');
                }
            };
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de l'EPUB:", error);
        if (errorContainer) errorContainer.innerHTML = '<p class="error">Impossible de charger les détails de ce livre.</p>';
    }
    return null; // Pas de fonction de nettoyage si la vue n'a pas pu être initialisée
}