// js/views/epubs.js
import { postWithFile } from '../api.js';

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

        // Afficher le texte dans le textarea
        const textContent = document.getElementById('epub-text-content');
        const placeholder = document.getElementById('epub-placeholder');
        if (textContent && placeholder) {
            textContent.value = result.text;
            textContent.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }

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

export function initEpubsView() {
    console.log("Vue E-books initialisée.");
    const addEpubButton = document.getElementById('add-epub-button');
    const epubFileInput = document.getElementById('epub-file-input');

    addEpubButton?.addEventListener('click', () => handleAddEpubClick(epubFileInput));
    epubFileInput?.addEventListener('change', handleFileSelected);
}