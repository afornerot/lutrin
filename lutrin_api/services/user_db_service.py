# lutrin_api/services/user_service.py
import sqlite3
import secrets
from werkzeug.security import generate_password_hash, check_password_hash
from .db_service import get_db_connection
from .logger_service import Log, Error, Success, Warning

def authenticate_user(username, password):
    """Authentifie un utilisateur et retourne sa clé d'API si les identifiants sont corrects."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            Success(f"Authentification réussie pour l'utilisateur '{username}'.")
            return {'api_key': user['api_key'], 'role': user['role']}
        else:
            Error(f"Échec de l'authentification pour l'utilisateur '{username}'.")
            return None
    except Exception as e:
        Error(f"Erreur lors de l'authentification de l'utilisateur : {e}")
        return None
    
def add_user(username, password, email, role='USER'):
    """Ajoute un nouvel utilisateur à la base de données."""
    if not all([username, password, email]):
        Error("Le nom d'utilisateur, le mot de passe et l'email sont obligatoires.")
        return False, "Le nom d'utilisateur, le mot de passe et l'email sont obligatoires."

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Vérifier si l'utilisateur ou l'email existe déjà
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            Error(f"L'utilisateur '{username}' existe déjà.")
            conn.close()
            return False, f"L'utilisateur '{username}' existe déjà."
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            Error(f"L'email '{email}' est déjà utilisé.")
            conn.close()
            return False, f"L'email '{email}' est déjà utilisé."

        password_hash = generate_password_hash(password)
        api_key = secrets.token_hex(16)

        cursor.execute(
            "INSERT INTO users (username, email, password_hash, api_key, role) VALUES (?, ?, ?, ?, ?)",
            (username, email, password_hash, api_key, role.upper())
        )
        conn.commit()
        conn.close()
        Success(f"Utilisateur '{username}' ajouté avec succès.")
        Log(f"Clé d'API pour {username}: {api_key}")
        return True, f"Utilisateur '{username}' ajouté avec succès.\nClé d'API pour {username}: {api_key}"
    except Exception as e:
        Error(f"Erreur lors de l'ajout de l'utilisateur : {e}")
        return False, f"Erreur lors de l'ajout de l'utilisateur : {e}"

def update_user(user_id, username=None, email=None, password=None, role=None, is_active=None):
    """Met à jour les informations d'un utilisateur."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        fields_to_update = []
        params = []

        if username is not None:
            fields_to_update.append("username = ?")
            params.append(username)
        if email is not None:
            fields_to_update.append("email = ?")
            params.append(email)
        if password is not None and password: # Ne met à jour que si un nouveau mot de passe est fourni
            fields_to_update.append("password_hash = ?")
            params.append(generate_password_hash(password))
        if role is not None:
            fields_to_update.append("role = ?")
            params.append(role.upper())
        if is_active is not None:
            fields_to_update.append("is_active = ?")
            params.append(is_active)

        if not fields_to_update:
            return True # Rien à mettre à jour

        query = f"UPDATE users SET {', '.join(fields_to_update)} WHERE id = ?"
        params.append(user_id)
        
        cursor.execute(query, tuple(params))
        conn.commit()
        conn.close()
        return cursor.rowcount > 0
    except Exception as e:
        Error(f"Erreur lors de la mise à jour de l'utilisateur ID {user_id}: {e}")
        return False

def update_user_password(email, new_password):
    """Met à jour le mot de passe d'un utilisateur via son email."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        new_password_hash = generate_password_hash(new_password)
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE email = ?",
            (new_password_hash, email)
        )
        conn.commit()
        if cursor.rowcount == 0:
            Warning(f"Tentative de mise à jour du mot de passe pour un email inexistant: {email}")
            return False
        Success(f"Mot de passe mis à jour pour l'utilisateur avec l'email {email}.")
        return True
    except Exception as e:
        Error(f"Erreur lors de la mise à jour du mot de passe pour {email}: {e}")
        return False

def delete_user(user_id):
    """Supprime un utilisateur par son ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    deleted_count = cursor.rowcount
    conn.close()
    return deleted_count > 0

def get_all_users():
    """Récupère tous les utilisateurs (sans les données sensibles)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, role FROM users")
        users = cursor.fetchall()
        conn.close()
        # Convertit les Row objects en dictionnaires
        return [dict(user) for user in users]
    except Exception as e:
        Error(f"Erreur lors de la récupération de tous les utilisateurs : {e}")
        return None

def get_user_by_api_key(api_key):
    """Récupère un utilisateur par sa clé d'API."""
    if not api_key:
        return None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE api_key = ?", (api_key,))
        user = cursor.fetchone()
        conn.close()
        return user
    except Exception as e:
        Error(f"Erreur lors de la recherche de l'utilisateur par clé d'API : {e}")
        return None

def get_api_key_by_username(username):
    """Récupère la clé d'API d'un utilisateur par son nom d'utilisateur."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT api_key FROM users WHERE username = ?", (username,))
        result = cursor.fetchone()
        conn.close()
        return result['api_key'] if result else None
    except Exception as e:
        Error(f"Erreur lors de la recherche de la clé d'API pour l'utilisateur '{username}': {e}")
        return None

def get_user_by_email(email):
    """Récupère un utilisateur par son adresse e-mail."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()
        return user
    except Exception as e:
        Error(f"Erreur lors de la recherche de l'utilisateur par email : {e}")
        return None

def get_user_by_username(username):
    """Récupère un utilisateur par son nom d'utilisateur."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()
        return user
    except Exception as e:
        Error(f"Erreur lors de la recherche de l'utilisateur par nom d'utilisateur : {e}")
        return None

def get_user_by_id(user_id):
    """Récupère un utilisateur par son ID."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        return user
    except Exception as e:
        Error(f"Erreur lors de la recherche de l'utilisateur par ID : {e}")
        return None


def count_users():
    """Compte le nombre total d'utilisateurs dans la base de données."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except Exception as e:
        Error(f"Erreur lors du comptage des utilisateurs : {e}")
        return -1

