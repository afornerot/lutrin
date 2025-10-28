# lutrin_api/services/epub_service.py
import os
import base64
from ebooklib import epub, ITEM_DOCUMENT, ITEM_COVER
from bs4 import BeautifulSoup
from .logger_service import *
from ..config import UPLOAD_FOLDER

def add_epub(file_storage, user_id):
    """
    Traite un fichier EPUB uploadé, en extrait le texte brut, les métadonnées
    et l'image de couverture, puis retourne le tout.
    """
    BigTitle(f"Traitement d'un nouveau fichier EPUB pour l'utilisateur ID: {user_id}")
    Log(f"Fichier reçu en mémoire : {file_storage.filename}")

    try:
        # EbookLib lit directement depuis l'objet fichier en mémoire
        book = epub.read_epub(file_storage)
        
        # --- Extraction des métadonnées ---
        metadata = {
            'title': book.get_metadata('DC', 'title')[0][0] if book.get_metadata('DC', 'title') else "Titre inconnu",
            'authors': [author[0] for author in book.get_metadata('DC', 'creator')] if book.get_metadata('DC', 'creator') else [],
            'language': book.get_metadata('DC', 'language')[0][0] if book.get_metadata('DC', 'language') else "Langue inconnue",
            'publisher': book.get_metadata('DC', 'publisher')[0][0] if book.get_metadata('DC', 'publisher') else None,
            'publication_date': book.get_metadata('DC', 'date')[0][0] if book.get_metadata('DC', 'date') else None,
        }
        Log(f"Métadonnées extraites : {metadata}")

        # --- Extraction de l'image de couverture ---
        cover_image_data = None
        cover_item = None

        # Méthode 1: Chercher un item de type ITEM_COVER
        cover_items = list(book.get_items_of_type(ITEM_COVER))
        if cover_items:
            cover_item = cover_items[0]
            Log("Image de couverture trouvée via ITEM_COVER.")

        # Méthode 2: Si non trouvée, chercher dans le guide EPUB
        if not cover_item:
            for item in book.guide:
                if item.get('type') == 'cover':
                    cover_item = book.get_item_with_href(item.get('href'))
                    Log("Image de couverture trouvée via le guide EPUB.")
                    break

        # Méthode 3: Si toujours non trouvée, chercher dans les métadonnées
        if not cover_item:
            for meta in book.get_metadata('OPF', 'meta'):
                if meta[1].get('name') == 'cover':
                    cover_item = book.get_item_with_id(meta[1].get('content'))
                    Log("Image de couverture trouvée via les métadonnées OPF.")
                    break

        if cover_item:
            # Si l'item de couverture est un document HTML, il faut trouver l'image à l'intérieur.
            if cover_item.get_type() == ITEM_DOCUMENT:
                Log("L'item de couverture est un document HTML, recherche de la balise <img>.")
                soup = BeautifulSoup(cover_item.get_content(), 'html.parser')
                img_tag = soup.find('img')
                if img_tag and img_tag.get('src'):
                    # On récupère le vrai item image via son href
                    img_href = img_tag.get('src')
                    cover_item = book.get_item_with_href(img_href)
                    Log(f"Image réelle trouvée avec href: {img_href}")

            # Maintenant, on traite l'item qui est (on l'espère) une vraie image
            if cover_item and cover_item.get_type() != ITEM_DOCUMENT:
                image_bytes = cover_item.get_content()
                encoded_image = base64.b64encode(image_bytes).decode('utf-8')
                cover_image_data = f"data:{cover_item.media_type};base64,{encoded_image}"
                Success("Image de couverture extraite et encodée en Base64.")

        # --- Extraction du texte ---
        all_text_fragments = []

        # Parcourir tous les documents (chapitres, etc.) du livre
        for item in book.get_items_of_type(ITEM_DOCUMENT):
            # Obtenir le contenu HTML du chapitre
            html_content = item.get_content()
            
            # Utiliser BeautifulSoup pour parser le HTML
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remplacer les balises <br> par un espace pour éviter que les mots ne se collent.
            for br in soup.find_all("br"):
                br.replace_with(" ")

            # Itérer sur les éléments de bloc pour préserver les paragraphes
            # et nettoyer les sauts de ligne inutiles à l'intérieur de chaque bloc.
            # On cible les balises qui représentent généralement un paragraphe ou un titre.
            block_elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'])
            if not block_elements:
                # Fallback pour les documents sans structure claire : on prend tout le texte.
                text = soup.get_text(separator=' ', strip=True)
                if text:
                    all_text_fragments.append(text)
            else:
                for element in block_elements:
                    # .get_text(strip=True) enlève les espaces superflus au début/fin.
                    # ' '.join(...split()) normalise les espaces multiples et les sauts de ligne à l'intérieur d'un paragraphe en un seul espace.
                    paragraph_text = ' '.join(element.get_text(strip=True).split())
                    if paragraph_text:
                        all_text_fragments.append(paragraph_text)

        full_text = "\n\n".join(all_text_fragments).strip()        
        Success(f"Extraction de {len(full_text)} caractères depuis '{file_storage.filename}'.")

        # --- Assemblage du résultat final ---
        result_data = {
            "metadata": metadata,
            "cover_image": cover_image_data,
            "text": full_text
        }
        return True, result_data

    except Exception as e:
        error_msg = f"Erreur lors du traitement du fichier EPUB '{file_storage.filename}': {e}"
        Error(error_msg)
        return False, error_msg