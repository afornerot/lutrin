# lutrin_api/services/user_service.py
from . import user_db_service
from .logger_service import Log, Error, Success

def get_all_users():
    """
    Récupère une liste de tous les utilisateurs avec des informations non sensibles.
    """
    Log("Récupération de la liste des utilisateurs.")
    users = user_db_service.get_all_users()
    if users is None:
        Error("Impossible de récupérer la liste des utilisateurs.")
        return None, "Erreur interne lors de la récupération des utilisateurs."
    
    Success(f"{len(users)} utilisateurs récupérés.")
    return users, "Utilisateurs récupérés avec succès."

def add_user(username, password, email, role):
    """
    Crée un nouvel utilisateur.
    """
    Log(f"Tentative de création de l'utilisateur '{username}' avec le rôle '{role}'.")
    if not all([username, password, email, role]):
        return False, "Tous les champs (username, password, email, role) sont requis."

    if user_db_service.get_user_by_username(username):
        return False, f"L'utilisateur '{username}' existe déjà."

    if user_db_service.get_user_by_email(email):
        return False, f"L'email '{email}' est déjà utilisé."

    success, msg = user_db_service.add_user(username, password, email, role)
    if success:
        Success(f"Utilisateur '{username}' créé avec succès.")
        return True, f"Utilisateur '{username}' créé avec succès."
    else:
        Error(f"Échec de la création de l'utilisateur '{username}'.")
        return False, msg

def update_user(user_id, data):
    """
    Met à jour un utilisateur existant.
    """
    Log(f"Tentative de mise à jour de l'utilisateur ID {user_id}.")
    if not user_db_service.get_user_by_id(user_id):
        return False, "Utilisateur non trouvé."

    if user_db_service.update_user(user_id, **data):
        Success(f"Utilisateur ID {user_id} mis à jour.")
        return True, f"Utilisateur ID {user_id} mis à jour avec succès."
    else:
        Error(f"Échec de la mise à jour de l'utilisateur ID {user_id}.")
        return False, "Erreur interne lors de la mise à jour."

def delete_user(user_id):
    """
    Supprime un utilisateur existant.
    """
    Log(f"Tentative de suppression de l'utilisateur ID {user_id}.")
    if user_db_service.delete_user(user_id):
        Success(f"Utilisateur ID {user_id} supprimé.")
        return True, f"Utilisateur ID {user_id} supprimé avec succès."
    return False, "Utilisateur non trouvé ou erreur lors de la suppression."