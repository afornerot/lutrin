# lutrin_api/services/password_db_service.py
import sqlite3

from .db_service import get_db_connection
from .logger_service import Log, Error

def get_password(token):
    """Récupère une demande de réinitialisation par son jeton."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM passwords WHERE token = ?", (token,))
        request = cursor.fetchone()
        conn.close()
        return request
    except sqlite3.IntegrityError as e:
        Error(f"Erreur lors de la récupération de la demande de réinitialisation : {e}")
        return None
    
def add_password(email, token, expires_at):
    """Ajoute une demande de réinitialisation à la DB."""
    try:
        conn = get_db_connection()
        # On supprime les anciens tokens pour le même email pour n'en garder qu'un valide
        conn.execute("DELETE FROM passwords WHERE email = ?", (email,))
        conn.execute(
            "INSERT INTO passwords (email, token, expires_at) VALUES (?, ?, ?)",
            (email, token, expires_at.isoformat())
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError as e:
        Error(f"Erreur lors de l'ajout de la demande de reset pour {email}: {e}")
        return False

def delete_password(token):
    """Supprime une demande de réinitialisation."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM passwords WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError as e:
        Error(f"Erreur lors de la suppression de la demande de réinitialisation : {e}")
        return False