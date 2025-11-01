// js/views/epubs.js
import { postWithFile } from '../api.js';
import { navigateTo } from '../router.js';
import { addEpubToDB, getEpubsForUser } from '../services/db_service.js';
import { getAuthUser } from '../auth.js';

function handleAddEpubClick(fileInput) {
    fileInput.click(); // Ouvre le sélecteur de fichier
}

async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const statusOverlay = document.getElementById('epub-upload-status-overlay');
    const statusText = document.getElementById('epub-upload-status-text');

    try {
        statusText.textContent = `Envoi de "${file.name}"...`;
        statusOverlay.classList.remove('hidden');

        const formData = new FormData();
        formData.append('epub_file', file);

        const result = await postWithFile('/epub/add', formData);

        const epubData = result.data;
        const currentUser = getAuthUser();

        // Calculer le nombre total de chapitres à partir du texte reçu
        const totalChapters = epubData.text ? epubData.text.split('\n\n').filter(c => c.trim() !== '').length : 0;

        // Enrichir l'objet avec l'ID de l'utilisateur avant de le sauvegarder
        const dataToStore = {
            ...epubData,
            userId: currentUser,
            readingProgress: { lastChapterRead: 0 }, // Initialiser la progression
            totalChapters: totalChapters // Sauvegarder le nombre total de chapitres
        };

        const newId = await addEpubToDB(dataToStore);
        console.log(`EPUB sauvegardé dans la base de données locale avec l'ID: ${newId}`);

        // Rafraîchir l'affichage de la bibliothèque
        await loadAndDisplayEpubs();

        statusText.textContent = "Fichier traité avec succès !";

        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error("Erreur lors de l'upload de l'EPUB:", error);
        statusText.textContent = `Erreur: ${error.message}`;
        // Laisser la modale ouverte en cas d'erreur pour que l'utilisateur voie le message
    } finally {
        // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
        event.target.value = '';
    }
}

/**
 * Charge les EPUBs depuis la base de données et les affiche dans la grille.
 */
async function loadAndDisplayEpubs() {
    const currentUser = getAuthUser();
    if (!currentUser) return;

    const filters = {
        style: document.getElementById('style-filter'),
        series: document.getElementById('series-filter'),
        author: document.getElementById('author-filter'),
        hideFinished: document.getElementById('hide-finished-toggle')
    };
    const grids = {
        inProgress: document.getElementById('in-progress-grid'),
        notStarted: document.getElementById('not-started-grid'),
        finished: document.getElementById('finished-grid')
    };

    const placeholders = {
        sectionFinished: document.getElementById('finished-section'),
        main: document.getElementById('epub-placeholder'),
        inProgress: document.getElementById('in-progress-placeholder'),
        notStarted: document.getElementById('not-started-placeholder'),
        finished: document.getElementById('finished-placeholder')
    };

    // Vider les grilles
    Object.values(grids).forEach(grid => { if (grid) grid.innerHTML = ''; });
    // Cacher tous les placeholders
    Object.values(placeholders).forEach(p => { if (p) p.classList.add('hidden'); });

    try {
        let allEpubs = await getEpubsForUser(currentUser);

        // --- Logique de tri global ---
        allEpubs.sort((a, b) => {
            const seriesA = a.metadata.series;
            const seriesB = b.metadata.series;
            const titleA = a.metadata.title.toLowerCase();
            const titleB = b.metadata.title.toLowerCase();

            // Cas 1: Les deux livres sont dans la même série
            if (seriesA && seriesA === seriesB) {
                const numA = a.metadata.series_number || 0;
                const numB = b.metadata.series_number || 0;
                // Si le numéro est identique (ou absent), on trie par titre
                if (numA === numB) {
                    return titleA.localeCompare(titleB);
                }
                return numA - numB;
            }

            // Cas 2: Un livre a une série, l'autre non (on groupe les séries en premier)
            if (seriesA && !seriesB) return -1;
            if (!seriesA && seriesB) return 1;

            // Cas 3: Les deux livres ont des séries différentes (on trie par nom de série)
            if (seriesA && seriesB) {
                return seriesA.localeCompare(seriesB);
            }

            // Cas 4: Aucun des deux n'a de série (on trie par titre)
            return titleA.localeCompare(titleB);
        });

        // --- Logique de peuplement des filtres ---
        const populateFilters = () => {
            const styles = [...new Set(allEpubs.map(e => e.metadata.style).filter(Boolean))];
            const series = [...new Set(allEpubs.map(e => e.metadata.series).filter(Boolean))];
            const authors = [...new Set(allEpubs.flatMap(e => e.metadata.authors).filter(Boolean))];

            filters.style.innerHTML = '<option value="">Tous les genres</option>' + styles.map(s => `<option value="${s}">${s}</option>`).join('');
            filters.series.innerHTML = '<option value="">Toutes les séries</option>' + series.map(s => `<option value="${s}">${s}</option>`).join('');
            filters.author.innerHTML = '<option value="">Tous les auteurs</option>' + authors.map(a => `<option value="${a}">${a}</option>`).join('');
        };

        // --- Logique de rendu ---
        const renderEpubs = () => {
            // Vider les grilles avant de les remplir
            Object.values(grids).forEach(grid => { if (grid) grid.innerHTML = ''; });
            Object.values(placeholders).forEach(p => { if (p) p.classList.add('hidden'); });

            const selectedStyle = filters.style.value;
            const selectedSeries = filters.series.value;
            const selectedAuthor = filters.author.value;
            const hideFinished = filters.hideFinished.checked;

            // Sauvegarder l'état du toggle dans le localStorage
            localStorage.setItem('lutrin_hide_finished', hideFinished);

            // Appliquer les filtres
            let filteredEpubs = allEpubs.filter(epub => {
                const styleMatch = !selectedStyle || epub.metadata.style === selectedStyle;
                const seriesMatch = !selectedSeries || epub.metadata.series === selectedSeries;
                const authorMatch = !selectedAuthor || epub.metadata.authors.includes(selectedAuthor);
                return styleMatch && seriesMatch && authorMatch;
            });

            // Gérer la visibilité de la section "Lus"
            placeholders.sectionFinished.style.display = hideFinished ? 'none' : 'block';

            if (filteredEpubs.length === 0) {
                placeholders.main.classList.remove('hidden');
                placeholders.main.textContent = "Aucun livre ne correspond à vos filtres.";
                return;
            }

            placeholders.main.classList.add('hidden');

            const categorizedEpubs = { inProgress: [], notStarted: [], finished: [] };

            filteredEpubs.forEach(epub => {
                const progress = epub.readingProgress?.lastChapterRead || 0;
                const total = epub.totalChapters || 0;

                if (progress === 0) {
                    categorizedEpubs.notStarted.push(epub);
                } else if (progress >= total && total > 0) {
                    categorizedEpubs.finished.push(epub);
                } else {
                    categorizedEpubs.inProgress.push(epub);
                }
            });

            const createCard = (epub) => {
                const card = document.createElement('div');
                card.className = 'cursor-pointer group';
                card.innerHTML = `
                     <div class="aspect-[2/3] bg-gray-200 rounded-lg overflow-hidden shadow-lg transform group-hover:scale-105 transition-transform duration-200">
                         <img src="${epub.cover_image || 'assets/placeholder-cover.png'}" alt="Couverture de ${epub.metadata.title}" class="w-full h-full object-cover">
                     </div>
                     <h3 class="mt-2 text-sm font-bold text-gray-800 truncate">${epub.metadata.title}</h3>
                     <p class="text-xs text-gray-500 truncate">${epub.metadata.authors.join(', ')}</p>
                     <div class="mt-1 flex flex-wrap gap-1 text-[10px]">
                        ${epub.metadata.style ? `
                            <span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full truncate">${epub.metadata.style}</span>
                        ` : ''}
                        ${epub.metadata.series ? `
                            <span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full truncate">
                                ${epub.metadata.series}
                                ${epub.metadata.series_number ? ` #${epub.metadata.series_number}` : ''}
                            </span>
                        ` : ''}
                     </div>
                 `;
                card.addEventListener('click', () => navigateTo(`/epub?id=${epub.id}`));
                return card;
            };

            categorizedEpubs.inProgress.forEach(epub => grids.inProgress.appendChild(createCard(epub)));
            categorizedEpubs.notStarted.forEach(epub => grids.notStarted.appendChild(createCard(epub)));
            categorizedEpubs.finished.forEach(epub => grids.finished.appendChild(createCard(epub)));

            // Afficher les placeholders si les sections sont vides
            if (categorizedEpubs.inProgress.length === 0) placeholders.inProgress.classList.remove('hidden');
            if (categorizedEpubs.notStarted.length === 0) placeholders.notStarted.classList.remove('hidden');
            if (categorizedEpubs.finished.length === 0) placeholders.finished.classList.remove('hidden');
        };

        if (allEpubs.length === 0) {
            placeholders.main.classList.remove('hidden');
        } else {
            // Restaurer l'état du toggle depuis le localStorage au chargement
            const savedHideFinished = localStorage.getItem('lutrin_hide_finished') === 'true';
            filters.hideFinished.checked = savedHideFinished;

            populateFilters();
            renderEpubs();

            // Ajouter les écouteurs d'événements pour les filtres
            filters.style.addEventListener('change', renderEpubs);
            filters.series.addEventListener('change', renderEpubs);
            filters.author.addEventListener('change', renderEpubs);
            filters.hideFinished.addEventListener('change', renderEpubs);
        }
    } catch (error) {
        console.error("Erreur lors du chargement des EPUBs depuis la base de données:", error);
        placeholders.main.textContent = "Erreur lors du chargement de la bibliothèque.";
        placeholders.main.classList.remove('hidden');
    }
}

export function initEpubsView() {
    console.log("Vue E-books initialisée.");
    const addEpubButton = document.getElementById('add-epub-button');
    const epubFileInput = document.getElementById('epub-file-input');

    addEpubButton?.addEventListener('click', () => handleAddEpubClick(epubFileInput));
    epubFileInput?.addEventListener('change', handleFileSelected);

    // Charger la bibliothèque au démarrage de la vue
    loadAndDisplayEpubs();
}