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


def _pick_best_google_result(metadata, google_results):
    """
    Utilise Groq pour analyser les résultats Google Books et choisir celui
    qui correspond le mieux aux métadonnées locales.
    """

    if not GROQ_TOKEN:
        Warning("GROQ_TOKEN non configuré. Analyse Groq désactivée.")
        return {"index": 0, "reason": "Token absent", "confidence": 0.0}

    Title("Étape 2: Désambiguïsation avec Groq (Google Books)")

    try:
        client = Groq(api_key=GROQ_TOKEN)

        # On simplifie les résultats Google Books pour éviter les JSON trop longs
        simplified_results = []
        for item in google_results[:10]:  # max 10 pour éviter d’exploser les tokens
            info = item.get("volumeInfo", {})
            simplified_results.append({
                "title": info.get("title"),
                "subtitle": info.get("subtitle"),
                "authors": info.get("authors"),
                "publishedDate": info.get("publishedDate"),
                "language": info.get("language"),
                "categories": info.get("categories"),
                "seriesInfo": info.get("seriesInfo"),
                "industryIdentifiers": info.get("industryIdentifiers"),
                "description": info.get("description"),
            })

        # Formatage des données pour le prompt
        metadata_str = json.dumps(metadata, indent=2, ensure_ascii=False)
        results_str = json.dumps(simplified_results, indent=2, ensure_ascii=False)

        prompt = f"""
Tu es un expert bibliothécaire chargé de trouver la meilleure correspondance entre un livre et plusieurs résultats Google Books.

Voici les métadonnées locales :
{metadata_str}

Voici les résultats Google Books (liste JSON) :
{results_str}

Analyse attentivement chaque résultat et choisis celui qui correspond le mieux
selon les critères suivants :
- Titre le plus proche (même ou traduction cohérente)
- Auteur identique ou très proche
- Langue cohérente (FR/EN)
- Date de publication la plus proche
- Série et numéro du tome si présents
- Description disponible (et traduite en français si besoin)

Réponds STRICTEMENT au format JSON :
{{
  "index": <numéro du meilleur résultat dans la liste>,
  "reason": "<explication courte du choix>",
  "confidence": <score entre 0 et 1>,
  "description_fr": "<description finale en français, traduite si nécessaire>"
}}

⚠️ Si la description du résultat choisi est déjà en français, garde-la telle quelle.
⚠️ Si elle est en anglais ou une autre langue, traduis-la intégralement en français.
⚠️ Si aucune description n'est disponible, renvoie "description_fr": null.
⚠️ Si aucun résultat n'est fiable, renvoie "index": -1 et "confidence": 0.
"""

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Tu es un expert bibliothécaire et documentaliste spécialisé en métadonnées de livres."},
                {"role": "user", "content": prompt}
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        choice = json.loads(chat_completion.choices[0].message.content)

        if not isinstance(choice.get("index"), int):
            choice = {"index": 0, "reason": "Réponse Groq invalide", "confidence": 0.0}

        Success(f"Groq a choisi le résultat #{choice['index']} (confiance {choice.get('confidence', 0):.2f}) : {choice.get('reason', '')}")
        return choice

    except Exception as e:
        Error(f"Erreur lors de l'appel à Groq pour la désambiguïsation : {e}")
        return {"index": 0, "reason": f"Erreur: {e}", "confidence": 0.0}

def _enhance_with_google_books(metadata):
    """
    Utilise l'API Google Books pour récupérer des données factuelles (description, etc.).
    """

    title = metadata.get('title')
    authors = metadata.get('authors', [])
    if not title or not authors:
        Warning("Titre ou auteur manquant, impossible d'enrichir via Google Books.")
        return metadata, None

    Title("Étape 2: Enrichissement avec Google Books API")

    try:
        # Construction de la requête
        query = f"intitle:{title} inauthor:{authors[0]}"
        url = f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=10&langRestrict=fr&country=FR"
        Log(f"Interrogation de Google Books avec la requête : {query}")

        # Requête API
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        google_results = data.get("items", [])
        if not google_results:
            Warning("Aucun livre correspondant trouvé sur Google Books.")
            return metadata, None

        # Étape Groq : désambiguïsation entre plusieurs résultats
        choice = _pick_best_google_result(metadata, google_results)
        best_index = choice.get("index", 0)
        if best_index < 0 or best_index >= len(google_results):
            Warning(f"Aucune correspondance fiable selon Groq ({choice.get('reason', '')}).")
            return metadata, None

        # Extraction des métadonnées
        Log(choice)
        book_info = google_results[best_index]["volumeInfo"]
        book_info["description"] = choice["description_fr"]
        Success(f"Résultat choisi par Groq : #{best_index} ({choice.get('reason', '')})")
        Log(book_info)

        # Extraction et enrichissement des métadonnées
        isbn = None
        if 'industryIdentifiers' in book_info:
            for identifier in book_info['industryIdentifiers']:
                if identifier['type'] == 'ISBN_13':
                    isbn = identifier['identifier']

        enhanced_data = {}
        if 'description' in book_info:
            enhanced_data['description'] = book_info['description']
        if 'authors' in book_info and book_info['authors']:
            enhanced_data['authors'] = book_info['authors']
        if 'categories' in book_info:
            enhanced_data['style'] = book_info['categories'][0]

        # Gestion des infos de série
        if 'seriesInfo' in book_info and 'volumeSeries' in book_info['seriesInfo']:
            series_info = book_info['seriesInfo']
            if 'volumeSeries' in series_info and len(series_info['volumeSeries']) > 0:
                series_name = series_info['volumeSeries'][0].get('seriesBookType') or series_info['volumeSeries'][0].get('seriesId')
                enhanced_data['series'] = series_name.replace('_', ' ').title()
                enhanced_data['series_number'] = series_info.get('bookDisplayNumber')
        elif 'subtitle' in book_info:
            subtitle = book_info['subtitle']
            match = re.search(r'^(.*?)(?:,)?\s*(?:Tome|T|Vol\.?|#)\s*(\d+)', subtitle, re.IGNORECASE)
            if match:
                enhanced_data['series'] = match.group(1).strip().title()
                enhanced_data['series_number'] = int(match.group(2))
            elif not metadata.get('series'):
                enhanced_data['series'] = subtitle.strip().title()

        return {**metadata, **enhanced_data}, isbn

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

def _compact_html(html: bytes) -> bytes:
    """
    - Décodage (UTF‑8 ou autre encodage détecté)
    - Remplacement des retours à la ligne, tabulations, multiples espaces
    - Retour en bytes (prêt pour BeautifulSoup)
    """
    # Décodage (la plupart des epub sont en UTF‑8)
    txt = html.decode('utf-8', errors='ignore')

    # 1️⃣ Supprimer les sauts de ligne à l’intérieur des balises
    #    (remplace \n, \r, \t par un simple espace)
    txt = re.sub(r'[\r\n\t]+', ' ', txt)

    # 2️⃣ Collapser plusieurs espaces consécutifs
    txt = re.sub(r' {2,}', ' ', txt)

    # 3️⃣ (Optionnel) enlever les espaces avant/ après les balises
    txt = re.sub(r'\s*(<[^>]+>)\s*', r'\1', txt)

    return txt.encode('utf-8')

def _clean_paragraph(text: str) -> str:
    """
    Nettoie le texte d'un paragraphe :
    - supprime les espaces multiples,
    - remplace les sauts de ligne internes par un espace,
    - garde un saut de ligne final (pour séparer les paragraphes).
    """

    # Enlève les retours chariot éventuels
    text = text.replace("\r", "")
    # Collapse les espaces/tabs multiples
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse plusieurs sauts de ligne en un seul
    text = re.sub(r"\n+", "\n", text)
    # Strip en début/fin
    return text.strip()

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
        # metadata_pass3 = _enhance_with_open_library(metadata_pass2, isbn)
        metadata = metadata_pass2 # Résultat final

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
        texts = []

        # Parcourir tous les documents (chapitres, etc.) du livre
        for item in book.get_items_of_type(ITEM_DOCUMENT):
            # Nettoyage du HTML brut
            cleaned_html = _compact_html(item.get_content())
            soup = BeautifulSoup(cleaned_html, 'html.parser')
            
            # On récupère les paragraphes <p>, <h1‑h6>, <pre>…
            for tag in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "pre"]):
                raw = tag.get_text(separator=" ", strip=True)
                if raw:
                    cleaned = _clean_paragraph(raw)
                    if cleaned:
                        texts.append(cleaned)

        # Joindre les fragments avec un double saut de ligne pour simuler des paragraphes.
        full_text = "\n\n".join(texts).strip()
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