# lutrin_api/services/register_db_service.py
import sqlite3
import secrets
import datetime
from .db_service import get_db_connection
from .user_db_service import add_user # Import add_user from the new user_db_service
from .logger_service import Error, Success, Warning

def get_register(token):
    """Récupère une demande d'inscription par son jeton de lien magique."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM registers WHERE token = ?", (token,))
        registration = cursor.fetchone()
        conn.close()
        return registration
    except Exception as e:
        Error(f"Erreur lors de la récupération de la demande d'inscription : {e}")
        return None

def add_register(username, email, token, expires_at):
    """Ajoute une nouvelle demande d'inscription à la base de données."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO registers (username, email, token, expires_at) VALUES (?, ?, ?, ?)",
            (username, email, token, expires_at.isoformat())
        )
        conn.commit()
        conn.close()
        Success(f"Demande d'inscription pour '{email}' (utilisateur: {username}) ajoutée avec succès.")
        return True
    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed: registers.email" in str(e):
            Error(f"L'email '{email}' est déjà en cours d'inscription ou déjà enregistré.")
        elif "UNIQUE constraint failed: registers.username" in str(e):
            Error(f"Le nom d'utilisateur '{username}' est déjà en cours d'inscription ou déjà enregistré.")
        elif "UNIQUE constraint failed: registers.token" in str(e):
            Error(f"Le jeton de lien magique est déjà utilisé (très improbable).")
        else:
            Error(f"Erreur d'intégrité lors de l'ajout de la demande d'inscription : {e}")
        return False
    except Exception as e:
        Error(f"Erreur lors de l'ajout de la demande d'inscription : {e}")
        return False

def delete_register(token):
    """Supprime une demande d'inscription."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM registers WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        Success(f"Demande d'inscription avec jeton '{token}' supprimée.")
        return True
    except Exception as e:
        Error(f"Erreur lors de la suppression de la demande d'inscription : {e}")
        return False