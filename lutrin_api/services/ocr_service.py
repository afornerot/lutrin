# lutrin_api/services/ocr_service.py

import pytesseract
import os
from config import TESSERACT_CMD, UPLOAD_FOLDER
from .optimizer_service import traiter_document_pour_ocr

# Configuration du chemin Tesseract pour l'interface Python
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

def ocr_image(filepath):
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie.
    """

    print(f"--- Début du traitement OCR pour l'image : {filepath} ---")
    try:
        # --- Étape 1: Optimisation de l'image ---
        base, ext = os.path.splitext(os.path.basename(filepath))
        optimized_filename = f"{base}_optimized.png"
        optimized_filepath = os.path.join(UPLOAD_FOLDER, optimized_filename)
        
        print("\nLancement de l'optimisation de l'image...")
        traiter_document_pour_ocr(filepath, optimized_filepath)
        print("Optimisation terminée.")

        # --- Étape 2: Exécution de Tesseract sur l'image optimisée ---
        config = '--psm 1 --oem 1'
        print(f"\nExécution de Tesseract sur l'image optimisée (lang: fra, config: '{config}')...")
        text = pytesseract.image_to_string(optimized_filepath, lang='fra', config=config)

        print(f"Texte brut retourné par Tesseract:\n---\n{text}\n---")

        stripped_text = text.strip()
        word_count = len(stripped_text.split())

        print(f"Traitement terminé. {word_count} mot(s) trouvé(s).")
        print("-" * 50)
        return stripped_text
    except pytesseract.TesseractNotFoundError:
        error_msg = "Erreur Tesseract: L'exécutable Tesseract est introuvable."
        print(error_msg)
        return error_msg
    except Exception as e:
        error_msg = f"Erreur OCR inattendue: {e}"
        print(error_msg)
        return error_msg
