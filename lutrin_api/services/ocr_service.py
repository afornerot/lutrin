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
        text = pytesseract.image_to_string(filepath, lang='fra')
        return text.strip()
    except pytesseract.TesseractNotFoundError:
        return "Erreur Tesseract: L'exécutable Tesseract est introuvable."
    except Exception as e:
        return f"Erreur OCR: {e}"
