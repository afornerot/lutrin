// js/services/db_service.js

const DB_NAME = 'LutrinDB';
const DB_VERSION = 1;
const EPUB_STORE_NAME = 'epubs';

/**
 * Ouvre la base de données IndexedDB et la configure si nécessaire.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Erreur d'ouverture de la base de données:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        // Ce gestionnaire n'est exécuté que si la version de la DB change
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Crée un "object store" (similaire à une table SQL)
            const store = db.createObjectStore(EPUB_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            // Crée un index sur 'userId' pour pouvoir filtrer les livres par utilisateur
            store.createIndex('userId_idx', 'userId', { unique: false });
            console.log("Object store 'epubs' créé ou mis à jour.");
        };
    });
}

/**
 * Ajoute un enregistrement d'EPUB à la base de données.
 * @param {object} epubData - L'objet contenant les données de l'epub (metadata, cover_image, text, userId).
 * @returns {Promise<number>} L'ID du nouvel enregistrement.
 */
export async function addEpubToDB(epubData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([EPUB_STORE_NAME], 'readwrite');
        transaction.oncomplete = () => resolve(request.result); // Résoudre la promesse quand la transaction est terminée
        transaction.onerror = (event) => reject(event.target.error); // Rejeter en cas d'erreur de transaction

        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.add(epubData);
    });
}

/**
 * Récupère tous les enregistrements d'EPUB pour un utilisateur donné.
 * @param {string} userId - L'identifiant de l'utilisateur.
 * @returns {Promise<Array<object>>} Une liste d'objets EPUB.
 */
export async function getEpubsForUser(userId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([EPUB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const index = store.index('userId_idx');
        const request = index.getAll(userId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Récupère un EPUB par son ID.
 * @param {number} id - L'ID de l'EPUB à récupérer.
 * @returns {Promise<object|undefined>} L'objet EPUB ou undefined s'il n'est pas trouvé.
 */
export async function getEpubById(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([EPUB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Met à jour un enregistrement EPUB existant dans la base de données.
 * @param {object} epubData - L'objet EPUB complet à sauvegarder (doit inclure l'ID).
 * @returns {Promise<number>} L'ID de l'enregistrement mis à jour.
 */
export async function updateEpub(epubData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([EPUB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.put(epubData); // 'put' met à jour si la clé existe, sinon ajoute.

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Supprime un EPUB de la base de données par son ID.
 * @param {number} id - L'ID de l'EPUB à supprimer.
 * @returns {Promise<void>}
 */
export async function deleteEpubFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([EPUB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };
        request.onerror = (event) => reject(event.target.error);
    });
}