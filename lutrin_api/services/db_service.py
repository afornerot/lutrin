# lutrin_api/services/db_service.py
import sqlite3
from config import DATABASE_PATH
from .logger_service import Log, Error, Success, Title

def get_db_connection():
    """Crée une connexion à la base de données SQLite."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("PRAGMA foreign_keys = ON") # Active les contraintes de clé étrangère
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
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS epubs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metadata TEXT NOT NULL,
                cover_image TEXT,
                text TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS registers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE, 
                email TEXT NOT NULL UNIQUE,
                token TEXT NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        Success("Base de données initialisée avec succès.")
    except Exception as e:
        Error(f"Erreur lors de l'initialisation de la base de données : {e}")