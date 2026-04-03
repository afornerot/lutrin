// js/views/library.js
import { get, del_, post, postWithFile } from '../api.js';
import { navigateTo } from '../router.js';
import { addEpubToDB, getEpubsForUser } from '../services/db_service.js';
import { getAuthUser, getAuthUserRole } from '../auth.js';
import { runTTS } from '../services/processing.js';

async function importEpub(epubData) {
    const statusOverlay = document.getElementById('library-status-overlay');
    const statusText = document.getElementById('library-status-text');

    try {
        statusText.textContent = `Import de "${epubData.metadata.title}"...`;
        statusOverlay.classList.remove('hidden');

        // Récupérer les données complètes du livre (texte + couverture HD)
        const fullData = await get(`/library/get/${epubData.id}`);
        const completeEpub = fullData.data;

        const currentUser = getAuthUser();

        // Vérifier si le livre existe déjà dans la DB locale pour cet utilisateur
        const localEpubs = await getEpubsForUser(currentUser);
        // On se base sur le titre et l'auteur pour la déduplication
        const alreadyExists = localEpubs.some(localEpub =>
            localEpub.metadata.title === completeEpub.metadata.title &&
            JSON.stringify(localEpub.metadata.authors) === JSON.stringify(completeEpub.metadata.authors)
        );

        if (alreadyExists) {
            alert("Ce livre est déjà dans votre bibliothèque locale.");
            statusOverlay.classList.add('hidden');
            return;
        }

        const totalChapters = completeEpub.text ? completeEpub.text.split('\n\n').filter(c => c.trim() !== '').length : 0;

        // On retire l'ID du serveur pour laisser IndexedDB en générer un nouveau.
        const { id, ...dataWithoutId } = completeEpub;

        const dataToStore = {
            ...dataWithoutId,
            userId: currentUser,
            readingProgress: { lastChapterRead: 0 },
            totalChapters: totalChapters
        };

        const newId = await addEpubToDB(dataToStore);
        console.log(`EPUB importé dans la DB locale avec l'ID: ${newId}`);

        statusText.textContent = "Livre importé avec succès !";

        setTimeout(() => {
            statusOverlay.classList.add('hidden');
            navigateTo('/epubs'); // Rediriger vers la bibliothèque locale
        }, 1500);

    } catch (error) {
        console.error("Erreur lors de l'import de l'EPUB:", error);
        statusText.textContent = `Erreur: ${error.message}`;
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 3000);
    }
}

let currentDescriptionPlayer = null;
let currentDescriptionIcon = null;
let isDescriptionLoading = false;

async function handleAdminFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusOverlay = document.getElementById('library-status-overlay');
    const statusText = document.getElementById('library-status-text');

    try {
        statusText.textContent = `Envoi de "${file.name}" vers la bibliothèque centrale...`;
        statusOverlay.classList.remove('hidden');

        const formData = new FormData();
        formData.append('epub_file', file);

        const result = await postWithFile('/library/add-from-file', formData);

        statusText.textContent = `Livre ajouté avec succès (ID: ${result.id})! Rafraîchissement...`;

        setTimeout(() => {
            statusOverlay.classList.add('hidden');
            initLibraryView(); // On rafraîchit la vue pour afficher le nouveau livre
        }, 2000);

    } catch (error) {
        console.error("Erreur lors de l'upload admin de l'EPUB:", error);
        statusText.textContent = `Erreur: ${error.message}`;
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 4000);
    } finally {
        event.target.value = '';
    }
}

export async function initLibraryView() {
    console.log("Vue Bibliothèque Centrale initialisée.");

    const filters = {
        title: document.getElementById('title-filter'),
        style: document.getElementById('style-filter'),
        series: document.getElementById('series-filter'),
        author: document.getElementById('author-filter'),
        hideDownloaded: document.getElementById('hide-downloaded-toggle'),
    };
    const listContainer = document.getElementById('library-list');
    const placeholder = document.getElementById('library-placeholder');
    const adminAddButton = document.getElementById('admin-add-epub-button');
    const adminFileInput = document.getElementById('admin-epub-file-input');

    // Logique du bouton d'ajout admin
    if (getAuthUserRole() === 'ADMIN') {
        adminAddButton.classList.remove('hidden');
        adminAddButton.addEventListener('click', () => adminFileInput.click());
        adminFileInput.addEventListener('change', handleAdminFileSelected);
    }


    try {
        const currentUser = getAuthUser();
        const response = await get('/library/list');
        const allEpubs = response.data;

        if (!allEpubs || allEpubs.length === 0) {
            placeholder.classList.remove('hidden');
            return;
        }

        // Récupérer les livres locaux pour savoir lesquels masquer
        const localEpubs = await getEpubsForUser(currentUser);
        const localBookIdentifiers = new Set(
            localEpubs.map(epub => `${epub.metadata.title}|${epub.metadata.authors.join(',')}`)
        );

        const populateFilters = () => {
            const styles = [...new Set(allEpubs.map(e => e.metadata.style).filter(Boolean))];
            const series = [...new Set(allEpubs.map(e => e.metadata.series).filter(Boolean))];
            const authors = [...new Set(allEpubs.flatMap(e => e.metadata.authors).filter(Boolean))];

            filters.style.innerHTML = '<option value="">Tous les genres</option>' + styles.map(s => `<option value="${s}">${s}</option>`).join('');
            filters.series.innerHTML = '<option value="">Toutes les séries</option>' + series.map(s => `<option value="${s}">${s}</option>`).join('');
            filters.author.innerHTML = '<option value="">Tous les auteurs</option>' + authors.map(a => `<option value="${a}">${a}</option>`).join('');
        };

        const renderEpubs = () => {
            listContainer.innerHTML = '';
            const titleQuery = filters.title.value.toLowerCase();
            const selectedStyle = filters.style.value;
            const selectedSeries = filters.series.value;
            const selectedAuthor = filters.author.value;
            const hideDownloaded = filters.hideDownloaded.checked;

            // Sauvegarder l'état du toggle dans le localStorage
            localStorage.setItem('lutrin_hide_downloaded', hideDownloaded);

            const filteredEpubs = allEpubs.filter(epub => {
                const titleMatch = !titleQuery || epub.metadata.title.toLowerCase().includes(titleQuery);
                const styleMatch = !selectedStyle || epub.metadata.style === selectedStyle;
                const seriesMatch = !selectedSeries || epub.metadata.series === selectedSeries;
                const authorMatch = !selectedAuthor || epub.metadata.authors.includes(selectedAuthor);
                return titleMatch && styleMatch && seriesMatch && authorMatch;
            });

            // Appliquer le filtre pour masquer les livres déjà téléchargés
            const displayEpubs = hideDownloaded
                ? filteredEpubs.filter(epub => {
                    const identifier = `${epub.metadata.title}|${epub.metadata.authors.join(',')}`;
                    return !localBookIdentifiers.has(identifier);
                })
                : filteredEpubs;

            if (displayEpubs.length === 0) {
                listContainer.innerHTML = '<p class="placeholder">Aucun livre ne correspond à vos filtres.</p>';
                return;
            }

            displayEpubs.forEach(epub => {
                const listItem = document.createElement('div');
                listItem.className = 'library-item';
                listItem.innerHTML = `
                    <!-- Colonne de gauche : Couverture -->
                    <div class="library-item-cover">
                        <img src="${epub.cover_image || 'assets/placeholder-cover.png'}" alt="Couverture de ${epub.metadata.title}">
                    </div>

                    <!-- Colonne de droite : Métadonnées -->
                    <div class="library-item-info">
                        <h3>${epub.metadata.title}</h3>
                        <p class="library-item-author">par ${epub.metadata.authors.join(', ')}</p>
                        
                        <div class="book-tags">
                            ${epub.metadata.style ? `<span class="tag tag-style">${epub.metadata.style}</span>` : ''}
                            ${epub.metadata.series ? `<span class="tag tag-series">${epub.metadata.series}${epub.metadata.series_number ? ` - Vol. ${epub.metadata.series_number}` : ''}</span>` : ''}
                        </div>

                        <p class="library-item-description">
                            ${epub.metadata.description || 'Aucune description disponible.'}
                        </p>
                    </div>

                    <!-- Colonne d'action : Boutons -->
                    <div class="library-item-actions">
                        <button title="Importer dans ma bibliothèque" class="import-button btn-icon">
                            <i class="fas fa-download"></i>
                        </button>
                        ${getAuthUserRole() === 'ADMIN' ? `
                            <button title="Modifier le livre" class="edit-button btn-icon">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                        ` : ''}
                        ${getAuthUserRole() === 'ADMIN' ? `
                            <button title="Supprimer de la bibliothèque centrale" class="delete-button btn-icon">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : ''}
                        </div>
                `;

                // Sélection des éléments cliquables
                const descriptionText = listItem.querySelector('.library-item-description');
                const coverContainer = listItem.querySelector('.library-item-cover');
                const importButton = listItem.querySelector('.import-button');
                const editButton = listItem.querySelector('.edit-button');
                const deleteButton = listItem.querySelector('.delete-button');

                // Ajout des écouteurs d'événements
                coverContainer?.addEventListener('click', () => importEpub(epub));

                importButton?.addEventListener('click', (e) => {
                    e.stopPropagation(); // Empêche le clic de se propager si jamais on remet un listener sur la ligne
                    importEpub(epub);
                });

                if (editButton) {
                    editButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditModal(epub, renderEpubs);
                    });
                }

                if (deleteButton) {
                    deleteButton.addEventListener('click', async (e) => {
                        e.stopPropagation(); // Empêche l'import de se déclencher
                        if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${epub.metadata.title}" de la bibliothèque centrale ?`)) {
                            await del_(`/library/delete/${epub.id}`);
                            listItem.remove(); // Supprime l'élément de la vue
                            // Pas besoin de rafraîchir toute la liste, juste supprimer l'élément
                        }
                    });
                }

                descriptionText?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const text = epub.metadata.description;
                    if (!text) return;

                    // Si une génération est déjà en cours, on ne fait rien pour éviter les doubles clics.
                    if (isDescriptionLoading) {
                        console.log("Génération TTS déjà en cours, veuillez patienter.");
                        return;
                    }

                    // Si un son est déjà en cours de lecture
                    if (currentDescriptionPlayer) {
                        // On arrête le son et on supprime l'icône
                        currentDescriptionPlayer.pause();
                        currentDescriptionPlayer.currentTime = 0;
                        currentDescriptionPlayer = null;
                        currentDescriptionIcon.remove();
                        currentDescriptionIcon = null;
                        return;
                    }


                    // Créer et afficher l'icône de chargement
                    const loadingIcon = document.createElement('i');
                    loadingIcon.className = 'fas fa-spinner fa-spin loading-icon';
                    descriptionText.appendChild(loadingIcon);
                    currentDescriptionIcon = loadingIcon;
                    isDescriptionLoading = true;

                    try {
                        const ttsResult = await runTTS(text);
                        loadingIcon.className = 'fas fa-volume-up loading-icon';

                        const audioPlayer = new Audio(ttsResult.audio_url);
                        currentDescriptionPlayer = audioPlayer;
                        currentDescriptionPlayer.srcObject = null; // Pour le tracking
                        currentDescriptionPlayer.src = ttsResult.audio_url + `?text=${text.substring(0, 10)}`; // Pour le tracking
                        audioPlayer.play();

                        audioPlayer.onended = () => {
                            loadingIcon.remove();
                        };
                    } catch (error) {
                        console.error("Erreur TTS pour la description:", error);
                        loadingIcon.remove();
                    } finally {
                        isDescriptionLoading = false; // On libère le verrou
                    }
                });

                listContainer.appendChild(listItem);
            });
        };

        // Restaurer l'état du toggle depuis le localStorage
        // Par défaut, on masque les livres téléchargés (la valeur n'est pas 'false')
        const savedHideDownloaded = localStorage.getItem('lutrin_hide_downloaded') !== 'false';
        filters.hideDownloaded.checked = savedHideDownloaded;

        populateFilters();
        renderEpubs();

        filters.title.addEventListener('input', renderEpubs);
        filters.style.addEventListener('change', renderEpubs);
        filters.series.addEventListener('change', renderEpubs);
        filters.author.addEventListener('change', renderEpubs);
        filters.hideDownloaded.addEventListener('change', renderEpubs);

    } catch (error) {
        console.error("Erreur lors du chargement de la bibliothèque centrale:", error);
        placeholder.textContent = "Erreur lors du chargement de la bibliothèque centrale.";
        placeholder.classList.remove('hidden');
    }
}

function openEditModal(epub, onSaveCallback) {
    const overlay = document.getElementById('library-edit-overlay');
    const coverPreview = document.getElementById('edit-cover-preview');
    const coverInput = document.getElementById('edit-cover-input');
    const authorsInput = document.getElementById('edit-authors-input');
    const styleInput = document.getElementById('edit-style-input');
    const seriesNameInput = document.getElementById('edit-series-name-input');
    const seriesNumberInput = document.getElementById('edit-series-number-input');
    const descriptionInput = document.getElementById('edit-description-input');
    const saveButton = document.getElementById('save-library-edit');
    const cancelButton = document.getElementById('cancel-library-edit');
    const coverWrapper = document.getElementById('edit-cover-preview-wrapper');

    let newCoverBase64 = null;

    // Populate fields
    coverPreview.src = epub.cover_image || 'assets/placeholder-cover.png';
    authorsInput.value = epub.metadata.authors.join(', ');
    styleInput.value = epub.metadata.style || '';
    seriesNameInput.value = epub.metadata.series || '';
    seriesNumberInput.value = epub.metadata.series_number || '';
    descriptionInput.value = epub.metadata.description || '';

    // Handlers
    const close = () => overlay.classList.add('hidden');

    const handleCoverChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            newCoverBase64 = e.target.result;
            coverPreview.src = newCoverBase64;
        };
        reader.readAsDataURL(file);
    };

    const saveChanges = async () => {
        const updatedData = {
            metadata: {
                authors: authorsInput.value.split(',').map(a => a.trim()).filter(Boolean),
                style: styleInput.value.trim(),
                series: seriesNameInput.value.trim(),
                series_number: seriesNumberInput.value ? parseInt(seriesNumberInput.value, 10) : null,
                description: descriptionInput.value.trim(),
            }
        };

        if (newCoverBase64) {
            updatedData.cover_image = newCoverBase64;
        }

        try {
            await post(`/library/update/${epub.id}`, updatedData);
            close();
            initLibraryView(); // On ré-initialise la vue pour recharger les données depuis le serveur
        } catch (error) {
            console.error("Erreur lors de la mise à jour du livre:", error);
            alert(`Erreur: ${error.message}`);
        }
    };

    // Attach listeners
    coverWrapper.onclick = () => coverInput.click();
    coverInput.onchange = handleCoverChange;
    saveButton.onclick = saveChanges;
    cancelButton.onclick = close;
    overlay.onclick = (e) => {
        if (e.target === overlay) close();
    };

    // Ajouter la sauvegarde avec la touche "Entrée"
    const inputs = [authorsInput, styleInput, seriesNameInput, seriesNumberInput, descriptionInput];
    inputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveChanges();
            }
        });
    });

    // Show modal
    overlay.classList.remove('hidden');
    setTimeout(() => authorsInput.focus(), 50); // Met le focus sur le premier champ
}