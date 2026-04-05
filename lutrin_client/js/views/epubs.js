// js/views/epubs.js
import { postWithFile } from '../api.js';
import { navigateTo } from '../router.js';
import { addEpubToDB, getEpubsForUser } from '../services/db_service.js';
import { getAuthUser } from '../auth.js';

function handleAddEpubClick(fileInput) {
    fileInput.click(); // Ouvre le sélecteur de fichier
}

async function handleFileSelected(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        return;
    }

    const statusOverlay = document.getElementById('epub-upload-status-overlay');
    const statusText = document.getElementById('epub-upload-status-text');

    try {
        statusOverlay.classList.remove('hidden');

        let successCount = 0;
        let errorCount = 0;
        const totalFiles = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusText.textContent = `Envoi ${i + 1}/${totalFiles}: "${file.name}"...`;

            try {
                const formData = new FormData();
                formData.append('epub_file', file);

                const result = await postWithFile('/epub/add', formData);

                const epubData = result.data;
                const currentUser = getAuthUser();

                const totalChapters = epubData.text ? epubData.text.split('\n\n').filter(c => c.trim() !== '').length : 0;

                const dataToStore = {
                    ...epubData,
                    userId: currentUser,
                    readingProgress: { lastChapterRead: 0 },
                    totalChapters: totalChapters
                };

                const newId = await addEpubToDB(dataToStore);
                console.log(`EPUB sauvegardé dans la base de données locale avec l'ID: ${newId}`);
                successCount++;
            } catch (error) {
                console.error(`Erreur lors de l'upload de "${file.name}":`, error);
                errorCount++;
            }
        }

        await loadAndDisplayEpubs();

        if (errorCount === 0) {
            statusText.textContent = `${successCount} livre(s) ajouté(s) avec succès !`;
        } else {
            statusText.textContent = `${successCount} ajouté(s), ${errorCount} erreur(s).`;
        }

        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error("Erreur lors de l'upload de l'EPUB:", error);
        statusText.textContent = `Erreur: ${error.message}`;
    } finally {
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
        sectionInProgress: document.getElementById('in-progress-section'),
        sectionNotStarted: document.getElementById('not-started-section'),
        activeSectionsWrapper: document.getElementById('active-sections-wrapper'),
        main: document.getElementById('epub-placeholder'),
        inProgress: document.getElementById('in-progress-placeholder'),
        notStarted: document.getElementById('not-started-placeholder'),
        finished: document.getElementById('finished-placeholder')
    };

    // Vider les grilles
    Object.values(grids).forEach(grid => { if (grid) grid.innerHTML = ''; });
    // Cacher les placeholders de texte uniquement
    [placeholders.main, placeholders.inProgress, placeholders.notStarted, placeholders.finished].forEach(p => {
        if (p) p.classList.add('hidden');
    });

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
            // Cacher les placeholders de texte uniquement
            [placeholders.main, placeholders.inProgress, placeholders.notStarted, placeholders.finished].forEach(p => {
                if (p) p.classList.add('hidden');
            });

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
            if (hideFinished) {
                placeholders.sectionFinished.classList.add('hidden');
            } else {
                placeholders.sectionFinished.classList.remove('hidden');
            }

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

                if (total === 0) {
                    // Pas d'info de chapitres : considéré comme non lu
                    categorizedEpubs.notStarted.push(epub);
                } else if (progress === 0) {
                    categorizedEpubs.notStarted.push(epub);
                } else if (progress >= total) {
                    categorizedEpubs.finished.push(epub);
                } else {
                    categorizedEpubs.inProgress.push(epub);
                }
            });

            // Si "Masquer les lus" est coché, on retire les livres terminés de l'affichage
            if (hideFinished) {
                categorizedEpubs.finished = [];
            }

            const createCard = (epub) => {
                const progress = epub.readingProgress?.lastChapterRead || 0;
                const total = epub.totalChapters || 0;
                let progressPercentage = 0;
                if (total > 0) {
                    progressPercentage = (progress / total) * 100;
                }

                // On affiche la barre de progression uniquement si la lecture a commencé
                const progressBarHTML = progress > 0 && progress < total ? `
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                ` : '';

                const card = document.createElement('div');
                card.className = 'book-card';
                card.innerHTML = `
                     <div class="book-cover">
                         <img src="${epub.cover_image || 'assets/placeholder-cover.png'}" alt="Couverture de ${epub.metadata.title}">
                     </div>
                     <h3 class="book-title">${epub.metadata.title}</h3>
                    ${progressBarHTML}
                     <p class="book-author">${epub.metadata.authors.join(', ')}</p>
                     <div class="book-tags">
                        ${epub.metadata.style ? `
                            <span class="tag tag-style">${epub.metadata.style}</span>
                        ` : ''}
                        ${epub.metadata.series ? `
                            <span class="tag tag-series">
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

            // Afficher/masquer les sections actives et ajuster le layout
            const hasInProgress = categorizedEpubs.inProgress.length > 0;
            const hasNotStarted = categorizedEpubs.notStarted.length > 0;

            if (hasInProgress) {
                placeholders.inProgress.classList.add('hidden');
                placeholders.sectionInProgress.classList.remove('hidden');
            } else {
                placeholders.inProgress.classList.remove('hidden');
                placeholders.sectionInProgress.classList.add('hidden');
            }

            if (hasNotStarted) {
                placeholders.notStarted.classList.add('hidden');
                placeholders.sectionNotStarted.classList.remove('hidden');
            } else {
                placeholders.notStarted.classList.remove('hidden');
                placeholders.sectionNotStarted.classList.add('hidden');
            }

            // Afficher le wrapper et ajuster les colonnes
            if (placeholders.activeSectionsWrapper) {
                placeholders.activeSectionsWrapper.classList.remove('hidden');
                placeholders.activeSectionsWrapper.style.display = 'grid';
                placeholders.activeSectionsWrapper.style.gap = '1.5rem';
                placeholders.activeSectionsWrapper.style.gridTemplateColumns = (hasInProgress && hasNotStarted) ? 'repeat(2, 1fr)' : '1fr';
            }

            if (!hideFinished && categorizedEpubs.finished.length === 0) {
                placeholders.finished.classList.remove('hidden');
                placeholders.sectionFinished.classList.add('hidden');
            } else if (!hideFinished) {
                placeholders.finished.classList.add('hidden');
                placeholders.sectionFinished.classList.remove('hidden');
            }
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