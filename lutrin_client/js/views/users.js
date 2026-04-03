// lutrin_client/js/views/users.js
import { get, post } from '../api.js'; // Assurez-vous que ces fonctions existent dans api.js

// Déclaration des variables globales pour les éléments du DOM
let usersTableBody, usersPlaceholder, addUserButton, userManagementMessage;

// Modale d'ajout/édition
let userModalOverlay, userModalTitle, userForm, userIdField, usernameField, emailField, passwordField, roleField, cancelUserModalButton;

// Modale de suppression
let deleteUserModalOverlay, deleteUsernameDisplay, deleteUseridDisplay, cancelDeleteUserButton, confirmDeleteUserButton;

let currentUserIdToDelete = null;

/**
 * Affiche un message de statut (succès/erreur).
 * @param {string} message Le message à afficher.
 * @param {boolean} isError Si le message est une erreur.
 */
function showMessage(message, isError = false) {
    // Vérifier si userManagementMessage est défini avant de l'utiliser
    if (!userManagementMessage) {
        console.error("userManagementMessage n'est pas défini. Impossible d'afficher le message.");
        return;
    }
    userManagementMessage.textContent = message;
    userManagementMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
    if (isError) {
        userManagementMessage.classList.add('bg-red-100', 'text-red-800');
    } else {
        userManagementMessage.classList.add('bg-green-100', 'text-green-800');
    }
    setTimeout(() => {
        userManagementMessage.classList.add('hidden');
    }, 5000);
}

/**
 * Charge et affiche la liste des utilisateurs.
 */
async function loadUsers() {
    console.log("Chargement des utilisateurs..."); // Garder ce log pour le débogage
    // Vérifier si les éléments du DOM sont définis
    if (!usersTableBody || !usersPlaceholder) {
        console.error("Les éléments du DOM pour la table des utilisateurs ne sont pas encore disponibles.");
        return;
    }
    usersTableBody.innerHTML = '';
    usersPlaceholder.classList.add('hidden');
    try {
        const response = await get('/user/list');
        const users = response.users;

        if (users.length === 0) {
            usersPlaceholder.classList.remove('hidden');
            return;
        }

        users.forEach(user => {
            const row = usersTableBody.insertRow();
            row.innerHTML = `
                <td class="px-1 py-4 text-left text-sm font-medium">
                    <button data-id="${user.id}" data-username="${user.username}" data-email="${user.email}" data-role="${user.role}" data-is_active="${user.is_active}"
                            class="edit-user-button fas fa-edit fa-2x text-blue-600 hover:text-blue-900 mr-1"></button>
                    <button data-id="${user.id}" data-username="${user.username}"
                            class="delete-user-button fas fa-trash-alt fa-2x text-red-600 hover:text-red-900"></button>
                </td>
                <td class="px-1 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.id}</td>
                <td class="px-1 py-4 whitespace-nowrap text-sm text-gray-500">${user.username}</td>
                <td class="px-1 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
                <td class="px-1 py-4 whitespace-nowrap text-sm text-gray-500">${user.role}</td>
            `;
        });

        document.querySelectorAll('.edit-user-button').forEach(button => {
            button.addEventListener('click', (e) => openUserModal(e.target.dataset.id, e.target.dataset));
        });
        document.querySelectorAll('.delete-user-button').forEach(button => {
            button.addEventListener('click', (e) => openDeleteUserModal(e.target.dataset.id, e.target.dataset.username));
        });

    } catch (error) {
        console.error("Erreur lors du chargement des utilisateurs:", error);
        showMessage(`Erreur lors du chargement des utilisateurs: ${error.message}`, true);
        usersPlaceholder.textContent = "Erreur lors du chargement des utilisateurs.";
        usersPlaceholder.classList.remove('hidden');
    }
}

/**
 * Ouvre la modale d'ajout/édition d'utilisateur.
 * @param {string|null} userId L'ID de l'utilisateur à modifier, ou null pour un nouvel utilisateur.
 * @param {object|null} userData Les données de l'utilisateur si en mode édition.
 */
function openUserModal(userId = null, userData = null) {
    // Vérifier si les éléments du DOM sont définis
    if (!userForm || !userIdField || !passwordField || !userModalTitle) {
        console.error("Les éléments du DOM pour la modale utilisateur ne sont pas encore disponibles.");
        return;
    }
    userForm.reset();
    userIdField.value = '';
    passwordField.placeholder = 'Laisser vide pour ne pas changer';

    if (userId && userData) {
        userModalTitle.textContent = 'Modifier l\'utilisateur';
        userIdField.value = userId;
        usernameField.value = userData.username;
        emailField.value = userData.email;
        roleField.value = userData.role;
        passwordField.removeAttribute('required');
    } else {
        userModalTitle.textContent = 'Ajouter un utilisateur';
        passwordField.setAttribute('required', 'required');
    }
    userModalOverlay.classList.remove('hidden');
}

/**
 * Gère la soumission du formulaire d'ajout/édition d'utilisateur.
 */
async function handleUserFormSubmit(event) {
    event.preventDefault();
    const userId = userIdField.value;
    const data = {
        username: usernameField.value,
        email: emailField.value,
        role: roleField.value,
    };

    if (passwordField.value) {
        data.password = passwordField.value;
    }

    try {
        let response;
        if (userId) {
            response = await post(`/user/update/${userId}`, data);
            showMessage(response.message || "Utilisateur mis à jour avec succès.");
        } else {
            response = await post('/user/add', data);
            showMessage(response.message || "Utilisateur ajouté avec succès.");
        }
        userModalOverlay.classList.add('hidden');
        loadUsers();
    } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'utilisateur:", error);
        showMessage(`Erreur lors de la sauvegarde de l'utilisateur: ${error.message}`, true);
    }
}

/**
 * Ouvre la modale de confirmation de suppression.
 * @param {string} userId L'ID de l'utilisateur à supprimer.
 * @param {string} username Le nom d'utilisateur à afficher.
 */
function openDeleteUserModal(userId, username) {
    // Vérifier si les éléments du DOM sont définis
    if (!deleteUsernameDisplay || !deleteUseridDisplay || !deleteUserModalOverlay) {
        console.error("Les éléments du DOM pour la modale de suppression ne sont pas encore disponibles.");
        return;
    }
    currentUserIdToDelete = userId;
    deleteUsernameDisplay.textContent = username;
    deleteUseridDisplay.textContent = userId;
    deleteUserModalOverlay.classList.remove('hidden');
}

/**
 * Gère la confirmation de suppression d'utilisateur.
 */
async function handleDeleteUserConfirm() {
    if (!currentUserIdToDelete) return;

    try {
        const response = await post(`/user/delete/${currentUserIdToDelete}`);
        showMessage(response.message || "Utilisateur supprimé avec succès.");
        deleteUserModalOverlay.classList.add('hidden');
        loadUsers();
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur:", error);
        showMessage(`Erreur lors de la suppression de l'utilisateur: ${error.message}`, true);
    } finally {
        currentUserIdToDelete = null;
    }
}

/**
 * Initialise la vue de gestion des utilisateurs.
 */
export function initUsersView() {
    console.log("Vue de gestion des utilisateurs initialisée.");

    // Assigner les éléments du DOM ici, après que le HTML de users.html est chargé
    usersTableBody = document.getElementById('users-table-body');
    usersPlaceholder = document.getElementById('users-placeholder');
    addUserButton = document.getElementById('add-user-button');
    userManagementMessage = document.getElementById('user-management-message');

    userModalOverlay = document.getElementById('user-modal-overlay');
    userModalTitle = document.getElementById('user-modal-title');
    userForm = document.getElementById('user-form');
    userIdField = document.getElementById('user-id-field');
    usernameField = document.getElementById('username-field');
    emailField = document.getElementById('email-field');
    passwordField = document.getElementById('password-field');
    roleField = document.getElementById('role-field');
    cancelUserModalButton = document.getElementById('cancel-user-modal');

    deleteUserModalOverlay = document.getElementById('delete-user-modal-overlay');
    deleteUsernameDisplay = document.getElementById('delete-username-display');
    deleteUseridDisplay = document.getElementById('delete-userid-display');
    cancelDeleteUserButton = document.getElementById('cancel-delete-user');
    confirmDeleteUserButton = document.getElementById('confirm-delete-user');

    loadUsers();

    // Attacher les écouteurs d'événements seulement si les éléments existent
    addUserButton?.addEventListener('click', () => openUserModal());
    userForm?.addEventListener('submit', handleUserFormSubmit);
    cancelUserModalButton?.addEventListener('click', () => userModalOverlay.classList.add('hidden'));

    confirmDeleteUserButton?.addEventListener('click', handleDeleteUserConfirm);
    cancelDeleteUserButton?.addEventListener('click', () => deleteUserModalOverlay.classList.add('hidden'));
}