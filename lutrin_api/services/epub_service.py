# lutrin_api/services/epub_service.py
import os
from ebooklib import epub, ITEM_DOCUMENT
from bs4 import BeautifulSoup
from .logger_service import *
from ..config import UPLOAD_FOLDER

def add_epub(file_storage, user_id):
    """
    Traite un fichier EPUB uploadé, en extrait le texte brut et le retourne.
    Le fichier n'est pas sauvegardé sur le disque.
    """
    BigTitle(f"Traitement d'un nouveau fichier EPUB pour l'utilisateur ID: {user_id}")
    Log(f"Fichier reçu en mémoire : {file_storage.filename}")

    try:
        # EbookLib lit directement depuis l'objet fichier en mémoire
        book = epub.read_epub(file_storage)
        
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
        return True, full_text

    except Exception as e:
        error_msg = f"Erreur lors du traitement du fichier EPUB '{file_storage.filename}': {e}"
        Error(error_msg)
        return False, error_msg