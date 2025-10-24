# lutrin_api/services/ocr_service.py
import os

from paddleocr import PaddleOCR
from config import UPLOAD_FOLDER
from .optimizer_service import traiter_document_pour_ocr

# Initialisation de PaddleOCR. 
print("Initialisation de PaddleOCR")
ocr_engine = PaddleOCR(use_angle_cls=True, lang='en')
print("PaddleOCR initialisé.")

def reordonner_double_page(resultat_ocr):
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
        return "Aucun texte ou coordonnée trouvé."

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

def ocr_image(filepath):
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie avec PaddleOCR.
    """

    print(f"--- Début du traitement OCR avec PaddleOCR pour : {filepath} ---")
    try:
        # Optimisation de l'image
        """"
        print("\nLancement de l'optimisation de l'image...")
        base, ext = os.path.splitext(os.path.basename(filepath))
        optimized_filename = f"{base}_optimized.png"
        optimized_filepath = os.path.join(UPLOAD_FOLDER, optimized_filename)
        traiter_document_pour_ocr(filepath, optimized_filepath)
        print("Optimisation terminée.")
        result = ocr_engine.predict(optimized_filepath)
        """

        # Exécution de PaddleOCR sur le fichier image qui retourne un objet plus structuré.
        result = ocr_engine.predict(filepath)

        # Déterminer les textes de pages gauche et droite
        full_text=reordonner_double_page(result)
        
        print("\n--- Texte complet ---\n")
        print(full_text)
        print("-" * 50)

        return full_text
    except Exception as e:
        error_msg = f"Erreur OCR inattendue: {e}"
        print(error_msg)
        return error_msg
