# lutrin_api/services/ocr_service.py
import os
import base64
import requests
from groq import Groq
from paddleocr import PaddleOCR
from .logger_service import *
from config import UPLOAD_FOLDER, OCR_IA_USE, OCR_IA_TOKEN

# Initialisation conditionnelle de PaddleOCR/Groq.
ocr_engine = None
if not OCR_IA_USE: # Si OCR_IA_USE est false, on utilise le moteur local PaddleOCR
    Info("Initialisation PaddleOCR")
    ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
else:
    Info("Initialisation Groq")

def _reordonner_double_page(resultat_ocr):
    """
    Réorganise le texte d'une double page scannée en supposant un milieu
    horizontal de l'image (l'axe Y) comme séparateur de page.
    """

    if not resultat_ocr:
        return ""
    
    # Le dictionnaire de résultat est généralement le premier élément de la liste 'result'
    res = resultat_ocr[0]
    
    # Extraire les textes et leurs coordonnées (polygones)
    textes = res.get('rec_texts', [])
    polys = res.get('rec_polys', [])
    
    if not textes or not polys:
        return "Aucun texte trouvé."

    # 1. Calculer la largeur maximale de l'image pour déterminer le milieu
    # On prend la coordonnée X maximale parmi toutes les boîtes (approximatif mais suffisant)
    max_x = max(p[:, 0].max() for p in polys)
    
    # Déterminer la position centrale de l'image (la "gouttière")
    centre_x = max_x / 2

    # 2. Préparer les données
    fragments = []
    for texte, poly in zip(textes, polys):
        # Calculer le centre horizontal (x_centre) et la coordonnée verticale supérieure (y_top)
        x_centre = poly[:, 0].mean()
        y_top = poly[:, 1].min()
        
        # Déterminer la page (0 pour gauche, 1 pour droite)
        page = 1 if x_centre > centre_x else 0
        
        fragments.append({
            'texte': texte,
            'page': page,
            'y_top': y_top
        })

    # 3. Trier les fragments : d'abord par page (0 puis 1), puis par position verticale (y_top croissant)
    fragments_tries = sorted(fragments, key=lambda f: (f['page'], f['y_top']))

    # 4. Concaténer le texte
    texte_final = ' '.join(f['texte'] for f in fragments_tries)
    
    return texte_final

def _delete_old_files():
    """
    Point d'entrée pour supprimer les anciens fichiers de résultat OCR.
    """

    Title("Nettoyage des anciens fichiers de résultat OCR")

    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith('ocr_result_') and filename.endswith('.txt'):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {filename} = {e}")


def _ocr_image_ia(filepath, output_filename): # Renommé de ocr_image_ia à _ocr_image_ia
    """
    Point d'entrée pour l'OCR via une API externe (Groq).
    """

    BigTitle(f"Traitement OCR avec Groq")

    # Suppression des anciens fichiers de résultat OCR
    _delete_old_files()

    # Tester la présence du tocken
    error_msg = ""
    if not OCR_IA_TOKEN:
        error_msg = "Le jeton d'API Groq est manquant dans la configuration."
        Error(error_msg)
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(error_msg)
        return error_msg, text_output_path

    # Traitement l'image par Groq
    try:
        Title("Traitement de l'image par Groq")
        client = Groq(api_key=OCR_IA_TOKEN)

        # Lire l'image et l'encoder en base64
        with open(filepath, "rb") as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
        image_data_url = f"data:image/jpeg;base64,{encoded_image}"
        Log(f"Image encodée en base64 (taille: {len(encoded_image)}).")

        # Envoyer la requête à Groq via la librairie Python
        Log("Envoi de la requête à l'API Groq")
        chat_completion = client.chat.completions.create(
            messages=[
                 {
                     "role": "user",
                     "content": [
                         {
                             "type": "text",
                             "text": """Tu es un expert en extraction de texte depuis des images de livres. Analyse cette image et extrais TOUT le texte visible, qu'il s'agisse d'une page simple ou d'une double page.

Instructions importantes :
- Extrais le texte dans l'ordre de lecture naturel (de gauche à droite, de haut en bas)
- Si c'est une double page, lis d'abord la page de gauche en entier, puis la page de droite
- Préserve la structure des paragraphes
- Ignore les numéros de page
- Ne commente pas, ne décris pas l'image, donne UNIQUEMENT le texte extrait
- Assure-toi que le texte est fluide et cohérent

Retourne uniquement le texte extrait, propre et lisible."""
                         },
                         {
                             "type": "image_url",
                             "image_url": {"url": image_data_url}
                         }
                     ]
                 }
             ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2,
            max_tokens=4000
        )
        Log("Réponse Groq reçue.")

        # Extraire le texte
        extracted_text = chat_completion.choices[0].message.content
        
        # Si le texte est vide après le traitement, assigner un message par défaut.
        if not extracted_text or not extracted_text.strip():
            extracted_text = "Aucun texte trouvé"

        Log(f"Texte extrait = {extracted_text[:300]}...")
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(extracted_text)

        Success(f"Texte OCR sauvegardé dans = {text_output_path}")
        return extracted_text, text_output_path

    except Exception as e:
        error_msg = f"Erreur inattendue lors du traitement Groq OCR: {repr(e)}"
        Error(f"{error_msg}")
        return "", error_msg

def _ocr_image_paddle(filepath, output_filename): 
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie avec PaddleOCR.
    Écrit le texte reconnu dans un fichier et retourne le texte et le chemin du fichier.
    """

    BigTitle(f"Traitement OCR avec PaddleOCR")

    # Suppression des anciens fichiers de résultat OCR
    _delete_old_files()

    # Tester la précence de paddle
    if not ocr_engine:
        error_msg = "Le moteur PaddleOCR) n'est pas initialisé"
        Error(f"{error_msg}")
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(error_msg)
        return error_msg, text_output_path


    # Traitement l'image par Paddle
    Title("Traitement de l'image par Paddle")
    try:
        # Exécution de PaddleOCR sur le fichier image qui retourne un objet plus structuré.
        result = ocr_engine.predict(filepath)

        # Déterminer les textes de pages gauche et droite
        full_text=_reordonner_double_page(result)
        
        # Si le texte est vide après le traitement, assigner un message par défaut.
        if not full_text or not full_text.strip():
            full_text = "Aucun texte trouvée"
        
        Log(f"Texte extrait = {full_text[:300]}...")

        # Écrire le texte reconnu dans le fichier spécifié
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(full_text)

        Success(f"Texte OCR sauvegardé dans = {text_output_path}")
       
        # Retourner le texte et le chemin du fichier
        return full_text, text_output_path
    except Exception as e:
        error_msg = f"Erreur OCR inattendue: {e}"
        Error(error_msg)
        return "", error_msg

def ocr_image(filepath, output_filename):
    """
    Aiguilleur principal pour le service OCR.
    Appelle le moteur local (PaddleOCR) ou une API externe en fonction de la configuration.
    """
    
    if OCR_IA_USE:
        return _ocr_image_ia(filepath, output_filename)
    return _ocr_image_paddle(filepath, output_filename)
