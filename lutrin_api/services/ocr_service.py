# lutrin_api/services/ocr_service.py
import os
import base64
from groq import Groq
from .logger_service import *
from config import UPLOAD_FOLDER, GROQ_TOKEN

def _delete_old_files(user_id):
    """
    Supprime les anciens fichiers de résultat OCR pour un utilisateur spécifique.
    """

    Title(f"Nettoyage des anciens fichiers OCR pour l'utilisateur ID: {user_id}")

    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    ocr_prefix_to_delete = f"ocr_result_{user_id}_"

    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith(ocr_prefix_to_delete):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {filename} = {e}")


def _ocr_image_groq(filepath, output_filename): # Renommé de ocr_image_ia à _ocr_image_groq
    """
    Point d'entrée pour l'OCR via une API externe (Groq).
    """

    # Tester la présence du tocken
    error_msg = ""
    if not GROQ_TOKEN:
        error_msg = "Le jeton d'API Groq est manquant dans la configuration."
        Error(error_msg)
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(error_msg)
        return error_msg, text_output_path

    # Traitement l'image par Groq
    try:
        Title("Traitement de l'image par Groq")
        client = Groq(api_key=GROQ_TOKEN)

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
"text": """Tu es un expert en extraction de texte depuis des images de livres, visant la perfection.

**Objectif Principal :** Extraire TOUT le texte visible de cette image de livre (page simple ou double) avec une fidélité absolue à l'original.

**Règles de Formatage Stricte :**
1.  **Structure des Paragraphes :** Chaque paragraphe de l'image DOIT être retranscrit comme un paragraphe distinct. Ne fusionne jamais les paragraphes, même s'ils sont courts.
2.  **Mots Coupés (Césures) :** Reconstitue les mots coupés en fin de ligne (ex: 'tour-ner' doit devenir 'tourner'). Le texte final doit être un français continu et correct.
3.  **Ordre de Lecture :** Lis strictement de gauche à droite, de haut en bas. Pour une double page, lis d'abord la page de gauche en ENTIER, puis la page de droite en ENTIER.
4.  **Nettoyage du Texte :**
    * IGNORE les numéros de page (26 et 27).
    * Ne décris pas l'image.
    * Ne fais aucun commentaire (ex: "Voici le texte extrait").

**L'unique sortie attendue est le texte extrait, propre, lisible et respectant scrupuleusement la structure des paragraphes et la continuité des mots.**"""                         
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

def ocr_image(filepath, output_filename, user_id=None):
    """
    Point d'entrée pour le service OCR via l'API Groq.
    """

    BigTitle("Traitement OCR avec Groq")
    if user_id:
        _delete_old_files(user_id)
    
    return _ocr_image_groq(filepath, output_filename)
