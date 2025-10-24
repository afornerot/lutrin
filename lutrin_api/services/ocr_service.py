# lutrin_api/services/ocr_service.py

from paddleocr import PaddleOCR

# Initialisation de PaddleOCR. 
# use_angle_cls=True pour détecter l'orientation du texte.
# lang='fr' pour spécifier le français.
# NOTE: Pour les langues latines, il est recommandé d'utiliser 'en', qui charge
# un modèle multilingue plus performant incluant le français.
# Le modèle sera téléchargé au premier lancement.
print("Initialisation de PaddleOCR (modèle multilingue pour langues latines)...")
ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
print("PaddleOCR initialisé.")

def ocr_image(filepath):
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie avec PaddleOCR.
    """

    print(f"--- Début du traitement OCR avec PaddleOCR pour : {filepath} ---")
    try:
        # Exécution de PaddleOCR sur le fichier image
        # qui retourne un objet plus structuré.
        result = ocr_engine.predict(filepath)

        # La méthode predict retourne une liste de résultats (un par image).
        # Nous traitons la première (et unique) image.
        all_text_lines = []
        if result and result[0]:
            ocr_result_for_image = result[0]
            # L'objet OCRResult est directement itérable. Chaque élément est une ligne détectée.
            # Chaque ligne est une liste contenant les coordonnées, le texte et le score.
            # Exemple de ligne : [[[x,y], [x,y], [x,y], [x,y]], ('texte reconnu', 0.99)]
            if ocr_result_for_image:
                for line in ocr_result_for_image:
                    all_text_lines.append(line[1][0])
        
        full_text = "\n".join(all_text_lines)

        print(f"Texte brut retourné par PaddleOCR:\n---\n{full_text}\n---")

        stripped_text = full_text.strip()
        word_count = len(stripped_text.split()) if stripped_text else 0

        print(f"Traitement terminé. {word_count} mot(s) trouvé(s).")
        print("-" * 50)
        return stripped_text
    except Exception as e:
        error_msg = f"Erreur OCR inattendue: {e}"
        print(error_msg)
        return error_msg
