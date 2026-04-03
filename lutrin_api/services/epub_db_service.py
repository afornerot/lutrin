# lutrin_api/services/epub_db_service.py
import sqlite3
import json
import base64
import io
from .db_service import get_db_connection
from .logger_service import Error, Success, Warning

def _resize_cover_image(cover_b64, max_width=300, max_height=450):
    """Redimensionne une image cover en base64 pour créer un thumbnail."""
    if not cover_b64:
        return None
    try:
        # Extraire le prefixe data:image/...;base64,
        if ',' in cover_b64:
            header, data = cover_b64.split(',', 1)
        else:
            header = 'data:image/jpeg;base64,'
            data = cover_b64

        image_bytes = base64.b64decode(data)
        img = io.BytesIO(image_bytes)

        try:
            from PIL import Image
            image = Image.open(img)
            image.thumbnail((max_width, max_height), Image.LANCZOS)

            output = io.BytesIO()
            image.save(output, format='JPEG', quality=75)
            resized_b64 = base64.b64encode(output.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{resized_b64}"
        except ImportError:
            # PIL non disponible, retourner l'image originale
            return cover_b64
    except Exception:
        return cover_b64

def get_all_epubs(with_text=False):
    """Récupère tous les EPUBs de la base de données de la bibliothèque."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if with_text:
            cursor.execute("SELECT id, metadata, cover_image, text FROM epubs")
        else:
            cursor.execute("SELECT id, metadata, cover_image FROM epubs")
        rows = cursor.fetchall()
        conn.close()
        epubs = [dict(row) for row in rows]
        for epub in epubs:
            epub['metadata'] = json.loads(epub['metadata'])
            # Générer un thumbnail de la couverture pour réduire la taille de la réponse
            if epub.get('cover_image'):
                epub['cover_image'] = _resize_cover_image(epub['cover_image'])
            if not with_text:
                epub['text'] = None
        return epubs
    except Exception as e:
        Error(f"Erreur lors de la récupération de la bibliothèque : {e}")
        return []

def add_epub(epub_data):
    """Ajoute un EPUB traité à la base de données de la bibliothèque."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO epubs (metadata, cover_image, text) VALUES (?, ?, ?)",
            (
                json.dumps(epub_data['metadata']),
                epub_data['cover_image'],
                epub_data['text']
            )
        )
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        Success(f"EPUB '{epub_data['metadata']['title']}' ajouté à la bibliothèque avec l'ID {new_id}.")
        return new_id
    except Exception as e:
        Error(f"Erreur lors de l'ajout de l'EPUB à la bibliothèque : {e}")
        return None

def update_epub(epub_id, update_data):
    """Met à jour un EPUB dans la base de données de la bibliothèque."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Récupérer l'enregistrement existant pour fusionner les données
        cursor.execute("SELECT metadata, cover_image FROM epubs WHERE id = ?", (epub_id,))
        row = cursor.fetchone()
        if not row:
            Warning(f"Aucun EPUB trouvé avec l'ID {epub_id} à mettre à jour.")
            conn.close()
            return False

        existing_metadata = json.loads(row['metadata'])
        existing_cover = row['cover_image']

        # Fusionner les nouvelles métadonnées et la couverture
        if 'metadata' in update_data:
            existing_metadata.update(update_data['metadata'])
        new_cover = update_data.get('cover_image', existing_cover)

        cursor.execute("UPDATE epubs SET metadata = ?, cover_image = ? WHERE id = ?",
                       (json.dumps(existing_metadata), new_cover, epub_id))
        conn.commit()
        conn.close()
        Success(f"EPUB avec l'ID {epub_id} mis à jour dans la bibliothèque.")
        return True
    except Exception as e:
        Error(f"Erreur lors de la mise à jour de l'EPUB ID {epub_id} : {e}")
        return False

def delete_epub(epub_id):
    """Supprime un EPUB de la base de données de la bibliothèque par son ID."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM epubs WHERE id = ?", (epub_id,))
        conn.commit()
        conn.close()
        if cursor.rowcount > 0:
            Success(f"EPUB avec l'ID {epub_id} supprimé de la bibliothèque.")
            return True
        else:
            Warning(f"Aucun EPUB trouvé avec l'ID {epub_id} à supprimer.")
            return False
    except Exception as e:
        Error(f"Erreur lors de la suppression de l'EPUB ID {epub_id} de la bibliothèque : {e}")
        return False
