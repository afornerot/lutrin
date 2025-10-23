# lutrin_api/services/ocr_service.py

import pytesseract
from config import TESSERACT_CMD

# Configuration du chemin Tesseract pour l'interface Python
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

def ocr_image(filepath):
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie.
    """
    try:
        # Configuration pour la langue française
        # Pour un débogage plus avancé, vous pouvez ajouter des options de configuration.
        # Par exemple, --psm 6 pour supposer qu'il s'agit d'un bloc de texte uniforme.
        # config = '--psm 6'

        config = '--psm 1 --oem 1'
        print(f"Exécution de Tesseract (langue: fra, config: '{config}')...")
        text = pytesseract.image_to_string(filepath, lang='fra', config=config)

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
