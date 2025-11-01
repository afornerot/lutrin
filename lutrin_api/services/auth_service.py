# lutrin_api/services/auth_service.py
import sqlite3
import secrets
from werkzeug.security import generate_password_hash, check_password_hash
from ..config import DATABASE_PATH
from .logger_service import Log, Error, Success, Title

def get_db_connection():
    """Crée une connexion à la base de données SQLite."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialise la base de données et crée la table des utilisateurs si elle n'existe pas."""
    Title("Initialisation de la base de données d'authentification")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                api_key TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')) DEFAULT 'USER'
            )
        ''')
        conn.commit()
        conn.close()
        Success("Base de données initialisée avec succès.")
    except Exception as e:
        # Gérer l'ajout de colonnes à une table existante
        if "duplicate column name" not in str(e):
            try:
                Log("Tentative de mise à jour de la table 'users' existante...")
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("ALTER TABLE users ADD COLUMN email TEXT UNIQUE")
                cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')) DEFAULT 'USER'")
                conn.commit()
                conn.close()
                Success("Table 'users' mise à jour avec les colonnes 'email' et 'role'.")
            except Exception as alter_e:
                Error(f"Erreur lors de la mise à jour de la table 'users': {alter_e}")

def add_user(username, password, email, role='USER'):
    """Ajoute un nouvel utilisateur à la base de données."""
    if not all([username, password, email]):
        Error("Le nom d'utilisateur, le mot de passe et l'email sont obligatoires.")
        return False

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Vérifier si l'utilisateur ou l'email existe déjà
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            Error(f"L'utilisateur '{username}' existe déjà.")
            conn.close()
            return False
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            Error(f"L'email '{email}' est déjà utilisé.")
            conn.close()
            return False

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
        return True
    except Exception as e:
        Error(f"Erreur lors de l'ajout de l'utilisateur : {e}")
        return False

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
            return None # Retourne None en cas d'échec
    except Exception as e:
        Error(f"Erreur lors de l'authentification de l'utilisateur : {e}")
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
        return -1 # Retourne -1 en cas d'erreur

def get_api_key_by_username(username):
    """Récupère la clé d'API d'un utilisateur par son nom d'utilisateur."""
    if not username:
        return None
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