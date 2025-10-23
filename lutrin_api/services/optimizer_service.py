import cv2
import numpy as np
from PIL import Image # Importation de PIL pour lire les métadonnées DPI

def obtenir_dpi_fichier(chemin_entree):
    """Tente d'obtenir le DPI (x et y) à partir des métadonnées du fichier."""
    try:
        # Ouverture avec PIL (Pillow) car cv2 ne lit pas les métadonnées DPI
        img_pil = Image.open(chemin_entree)
        
        # Le DPI est stocké dans l'attribut 'info' sous la clé 'dpi'
        if 'dpi' in img_pil.info:
            # Retourne le DPI X (le premier élément du tuple)
            return img_pil.info['dpi'][0]
        else:
            # Si Tesseract a donné 0 DPI, on retourne 0
            return 0
    except Exception as e:
        # En cas d'erreur de lecture
        print(f"Erreur lors de la lecture des métadonnées DPI: {e}")
        return 0

# --- Définition de la fonction principale optimisée ---

def optimiser_image_pour_ocr(chemin_entree, chemin_sortie="image_optimisee.png", resolution_cible=300):
    """
    Optimise une image pour Tesseract OCR, en la redimensionnant si la résolution
    détectée est inférieure à la résolution cible (300 DPI).
    """
    
    # 1. Détection de la résolution initiale
    # Nous utilisons soit la résolution trouvée dans le fichier, soit une estimation (comme 159).
    resolution_initiale = obtenir_dpi_fichier(chemin_entree)
    
    # Si le DPI est absent (0) ou invalide, nous utilisons l'estimation de Tesseract (159)
    if resolution_initiale < 70:
        resolution_initiale = 159
        print(f"DPI non trouvé dans le fichier. Utilisation de l'estimation Tesseract: {resolution_initiale} DPI.")
    else:
        print(f"DPI trouvé dans le fichier: {resolution_initiale} DPI.")

    # 2. Chargement de l'image (avec cv2 pour le traitement)
    image = cv2.imread(chemin_entree)
    if image is None:
        print(f"Erreur : Impossible de charger l'image à l'adresse {chemin_entree}")
        return

    gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 3. Redimensionnement Conditionnel (pour atteindre la résolution cible)
    if resolution_initiale < resolution_cible:
        facteur_agrandissement = resolution_cible / resolution_initiale
        
        gris = cv2.resize(gris, None, 
                          fx=facteur_agrandissement, 
                          fy=facteur_agrandissement, 
                          interpolation=cv2.INTER_LINEAR)
        
        print(f"Redimensionnement appliqué par un facteur de {facteur_agrandissement:.2f} pour atteindre {resolution_cible} DPI.")
    else:
        print(f"Pas de redimensionnement : {resolution_initiale} DPI est suffisant.")

    # 4. Amélioration du Contraste/Lissage et Binarisation Adaptative (votre code précédent)
    
    flou = cv2.GaussianBlur(gris, (3, 3), 0)
    print("Léger lissage Gaussien effectué.")
    
    binarisee = cv2.adaptiveThreshold(flou, 255, 
                                      cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 
                                      15, 5)

    image_finale = binarisee
    print("Binarisation Adaptative (Gaussien) effectuée.")
    
    # 5. Sauvegarde de l'image optimisée
    cv2.imwrite(chemin_sortie, image_finale)
    print(f"Image optimisée enregistrée sous : {chemin_sortie}")
    print("\n--- INSTRUCTION TESSERACT RECOMMANDÉE ---")
    print(f"Utilisez le mode 5 pour les doubles colonnes : tesseract {chemin_sortie} - -l fra --psm 5")


# --- Utilisation du script (Exemple) ---
# chemin_image_entree = "lutrin_data/test01.jpg" 
# chemin_image_sortie = "test01_optimise_v4.png"
# optimiser_image_pour_ocr(chemin_image_entree, chemin_image_sortie)