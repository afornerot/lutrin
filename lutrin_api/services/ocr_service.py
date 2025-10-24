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

def ocr_image(filepath, output_filename): 
    """
    Exécute la reconnaissance de caractères (OCR) sur l'image fournie avec PaddleOCR.
    Écrit le texte reconnu dans un fichier et retourne le texte et le chemin du fichier.
    """

    print(f"--- Début du traitement OCR avec PaddleOCR pour : {filepath} ---")
    try:
        # --- Suppression des anciens fichiers de résultat OCR ---
        print("Nettoyage des anciens fichiers de résultat OCR...")
        # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
        for filename in os.listdir(UPLOAD_FOLDER):
            # Si le fichier correspond au pattern des fichiers de résultat OCR
            if filename.startswith('ocr_result_') and filename.endswith('.txt'):
                try:
                    file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                    os.remove(file_path_to_delete)
                    print(f"Ancien fichier OCR supprimé : {file_path_to_delete}")
                except OSError as e:
                    # On ne bloque pas le processus si une suppression échoue, on logue juste l'erreur
                    print(f"Erreur lors de la suppression du fichier {filename}: {e}")

        # Optimisation de l'images
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
        
        # Écrire le texte reconnu dans le fichier spécifié
        text_output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        with open(text_output_path, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f"Texte OCR sauvegardé dans : {text_output_path}")
        
        # Retourner le texte et le chemin du fichier
        return full_text, text_output_path
    except Exception as e:
        error_msg = f"Erreur OCR inattendue: {e}"
        print(error_msg)
        return "", error_msg
