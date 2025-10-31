# lutrin_api/services/epub_service.py
import os
import base64
import json
from ebooklib import epub, ITEM_DOCUMENT, ITEM_COVER
import re
import requests
from bs4 import BeautifulSoup
from groq import Groq
from .logger_service import *
from ..config import UPLOAD_FOLDER, GROQ_TOKEN

def _enhance_with_groq(metadata):
    """
    Utilise Groq pour analyser, corriger et enrichir les métadonnées d'un livre.
    """
    if not GROQ_TOKEN:
        Warning("GROQ_TOKEN non configuré. L'enrichissement des métadonnées est désactivé.")
        return metadata

    Title("Étape 1: Enrichissement des métadonnées avec Groq")
    try:
        client = Groq(api_key=GROQ_TOKEN)
        metadata_str = json.dumps(metadata, indent=2, ensure_ascii=False)

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Tu es un expert bibliothécaire. Analyse les métadonnées fournies. Ton but est de nettoyer le titre et d'extraire les informations de série. Retourne UNIQUEMENT un objet JSON valide avec les champs 'title' (le titre propre du livre, sans la série), 'style' (le genre principal, ex: 'Science-Fiction'), 'series' (le nom de la série, ou null), et 'series_number' (le numéro dans la série, ou null). N'invente AUCUNE information, surtout pas de description."},
                {"role": "user", "content": f"Analyse ces métadonnées et retourne les champs demandés : \n\n{metadata_str}"}
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        enhanced_data = json.loads(chat_completion.choices[0].message.content)
        Success("Analyse par Groq terminée.")

        # Mettre le titre en "Title Case" (majuscule à chaque mot)
        if 'title' in enhanced_data and enhanced_data['title']:
            enhanced_data['title'] = enhanced_data['title'].title()

        # Fusionner les données enrichies avec les métadonnées originales
        return {**metadata, **enhanced_data}
    except Exception as e:
        Error(f"Erreur lors de l'appel à Groq pour l'enrichissement des métadonnées : {e}")
        return metadata # En cas d'erreur, on retourne les métadonnées originales

def _enhance_with_google_books(metadata):
    """
    Utilise l'API Google Books pour récupérer des données factuelles (description, etc.).
    """
    title = metadata.get('title')
    authors = metadata.get('authors', [])
    if not title or not authors:
        Warning("Titre ou auteur manquant, impossible d'enrichir via Google Books.")
        return metadata

    Title("Étape 2: Enrichissement avec Google Books API")
    try:
        query = f"intitle:{title} inauthor:{authors[0]}"
        url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=1"
        isbn = None
        
        Log(f"Interrogation de Google Books avec la requête : {query}")
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if 'items' in data and len(data['items']) > 0:
            book_info = data['items'][0]['volumeInfo']
            Success(f"Livre trouvé sur Google Books : '{book_info}'")

            # Extraire l'ISBN-13 si disponible, c'est la clé pour d'autres API
            if 'industryIdentifiers' in book_info:
                for identifier in book_info['industryIdentifiers']:
                    if identifier['type'] == 'ISBN_13':
                        isbn = identifier['identifier']

            enhanced_data = {}
            # On prend la description de Google Books en priorité
            if 'description' in book_info:
                enhanced_data['description'] = book_info['description']

            # On prend l'auteur de Google pour uniformiser
            if 'authors' in book_info and book_info['authors']:
                enhanced_data['authors'] = book_info['authors']

            # On prend la catégorie de Google en priorité
            if 'categories' in book_info:
                enhanced_data['style'] = book_info['categories'][0]
            
            # On essaie de récupérer les infos de série depuis Google Books en priorité
            if 'seriesInfo' in book_info and 'volumeSeries' in book_info['seriesInfo']:
                series_info = book_info['seriesInfo']
                if 'volumeSeries' in series_info and len(series_info['volumeSeries']) > 0:
                    # Le nom de la série est souvent dans le titre de la série, il faut le nettoyer
                    series_name = series_info['volumeSeries'][0].get('seriesBookType') or series_info['volumeSeries'][0].get('seriesId')
                    enhanced_data['series'] = series_name.replace('_', ' ').title()
                    enhanced_data['series_number'] = series_info.get('bookDisplayNumber')
            # SINON, on essaie d'extraire la série depuis le sous-titre (cas très fréquent)
            elif 'subtitle' in book_info:
                subtitle = book_info['subtitle']
                # 1. Essayer de trouver la série ET le numéro
                match = re.search(r'^(.*?)(?:,)?\s*(?:Tome|T|Vol\.?|#)\s*(\d+)', subtitle, re.IGNORECASE)
                if match:
                    enhanced_data['series'] = match.group(1).strip().title()
                    enhanced_data['series_number'] = int(match.group(2))
                # 2. SINON, si on n'a toujours pas de série, on prend le sous-titre entier comme nom de série
                elif not metadata.get('series'):
                    enhanced_data['series'] = subtitle.strip().title()


            return {**metadata, **enhanced_data}, isbn
        else:
            Warning("Aucun livre correspondant trouvé sur Google Books.")
            return metadata, None

    except Exception as e:
        Error(f"Erreur lors de l'appel à l'API Google Books : {e}")
        return metadata, None

def _enhance_with_open_library(metadata, isbn=None):
    """
    Utilise l'API Open Library, de préférence avec un ISBN, pour combler les lacunes.
    """
    if not isbn:
        Warning("Aucun ISBN fourni par Google Books, l'enrichissement via Open Library est moins fiable.")
        return metadata

    # Si on a déjà toutes les infos, on ne fait rien.
    if metadata.get('series') and metadata.get('series_number'):
        return metadata

    Title("Étape 3: Enrichissement avec Open Library API")
    try:
        url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        Log(f"Interrogation de Open Library avec l'ISBN : {isbn}")
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        Log(data)

        book_key = f"ISBN:{isbn}"
        if book_key in data and data[book_key]:
            book_info = data[book_key]
            Success(f"Livre trouvé sur Open Library : '{book_info.get('title')}'")

            enhanced_data = {}
            # Open Library est souvent bon pour les séries
            if 'series' in book_info and not metadata.get('series'):
                # Le nom de la série est souvent dans une liste
                series_name = book_info['series'][0]
                enhanced_data['series'] = series_name
                # Le numéro de volume n'est pas un champ standard, il faut le chercher
                # dans le titre ou le sous-titre, ce que Groq a déjà tenté de faire.
                # On se contente du nom de la série pour l'instant.

            return {**metadata, **enhanced_data}
        else:
            Warning("Aucun livre correspondant trouvé sur Open Library.")
            return metadata

    except Exception as e:
        Error(f"Erreur lors de l'appel à l'API Open Library : {e}")
        return metadata

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
        Log(f"Métadonnées brutes extraites : {metadata}")

        # Chaînage des enrichissements
        metadata_pass1 = _enhance_with_groq(metadata)
        metadata_pass2, isbn = _enhance_with_google_books(metadata_pass1)
        metadata_pass3 = _enhance_with_open_library(metadata_pass2, isbn)
        metadata = metadata_pass3 # Résultat final

        # --- Extraction de l'image de couverture ---
        cover_image_data = None
        cover_item = None

        Title("Traitement de l'image de couverture")

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

        Title("Traitement du texte du livre")
        all_text_fragments = []

        # Parcourir tous les documents (chapitres, etc.) du livre
        for item in book.get_items_of_type(ITEM_DOCUMENT):
            # Obtenir le contenu HTML du chapitre
            html_content = item.get_content()
            
            # Utiliser BeautifulSoup pour parser le HTML
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remplacer les balises <br> par un marqueur unique.
            br_marker = "::BR::"
            for br in soup.find_all("br"):
                br.replace_with(br_marker)

            # Itérer sur les éléments de bloc pour préserver les paragraphes
            # et nettoyer les sauts de ligne inutiles à l'intérieur de chaque bloc.
            # On cible les balises qui représentent généralement un paragraphe ou un titre.
            # On traite chaque élément de bloc comme un fragment de texte séparé.
            for element in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div']):
                # .get_text(strip=True) enlève les espaces superflus au début/fin.
                # ' '.join(...split()) normalise les espaces multiples et les sauts de ligne à l'intérieur d'un paragraphe en un seul espace.
                paragraph_text = ' '.join(element.get_text(strip=True).split())

                # Rétablir les sauts de ligne à partir du marqueur.
                paragraph_text = paragraph_text.replace(br_marker, "\n\n")
                
                # Même si le paragraphe est vide (contient juste &nbsp;), on le garde pour préserver les sauts de ligne.
                # Un paragraphe vide sera représenté par une chaîne vide, qui deviendra un saut de ligne lors du .join().
                all_text_fragments.append(paragraph_text)

        # Joindre les fragments avec un double saut de ligne pour simuler des paragraphes.
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