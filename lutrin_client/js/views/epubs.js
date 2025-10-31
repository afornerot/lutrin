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

    const grids = {
        inProgress: document.getElementById('in-progress-grid'),
        notStarted: document.getElementById('not-started-grid'),
        finished: document.getElementById('finished-grid')
    };

    const placeholders = {
        main: document.getElementById('epub-placeholder'),
        inProgress: document.getElementById('in-progress-placeholder'),
        notStarted: document.getElementById('not-started-placeholder'),
        finished: document.getElementById('finished-placeholder')
    };

    // Vider les grilles
    Object.values(grids).forEach(grid => grid.innerHTML = '');
    // Cacher tous les placeholders
    Object.values(placeholders).forEach(p => p.classList.add('hidden'));

    try {
        const epubs = await getEpubsForUser(currentUser);

        if (epubs.length === 0) {
            placeholders.main.classList.remove('hidden');
        } else {
            placeholders.main.classList.add('hidden');

            const categorizedEpubs = { inProgress: [], notStarted: [], finished: [] };

            epubs.forEach(epub => {
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