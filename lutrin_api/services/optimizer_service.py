import cv2
import numpy as np
from PIL import Image
import sys

# --- FONCTIONS UTILITAIRES POUR LA TRANSFORMATION DE PERSPECTIVE ---

def order_points(pts):
    """
    Réordonne les quatre points d'un quadrilatère (la page) dans l'ordre:
    (haut-gauche, haut-droite, bas-droite, bas-gauche).
    """
    # initialiser une liste de coordonnées que nous allons réordonner
    # de haut-gauche, haut-droite, bas-droite, et bas-gauche
    rect = np.zeros((4, 2), dtype="float32")

    # la somme des coordonnées (x, y) identifie le coin haut-gauche
    # (la plus petite somme) et le coin bas-droite (la plus grande somme)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)] # Haut-Gauche
    rect[2] = pts[np.argmax(s)] # Bas-Droite

    # la différence entre les coordonnées (x - y) identifie le coin
    # haut-droite (la plus petite différence) et le coin bas-gauche
    # (la plus grande différence)
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # Haut-Droite
    rect[3] = pts[np.argmax(diff)] # Bas-Gauche

    return rect

def four_point_transform(image, pts):
    """
    Applique une transformation de perspective (redressement) sur les quatre points donnés.
    """
    # obtenir un tableau ordonné de points
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # calculer la largeur de la nouvelle image (maximum de la largeur du haut et du bas)
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    # calculer la hauteur de la nouvelle image (maximum de la hauteur de gauche et de droite)
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    # définir les points de destination pour la transformation (un rectangle parfait)
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")

    # calculer la matrice de transformation de perspective
    M = cv2.getPerspectiveTransform(rect, dst)
    # appliquer la transformation
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped

# --- FONCTION PRINCIPALE DE DÉTECTION ET DE TRAITEMENT ---

def detect_and_crop_page(image):
    """Détecte le plus grand quadrilatère (la page) dans l'image, le recadre et le redresse."""
    
    # 1. Prétraitement pour la détection
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Utiliser un seuillage adaptatif pour obtenir des bords nets, même avec un éclairage inégal
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    
    # Inverser le seuil pour s'assurer que les bords clairs/sombres sont bien détectés
    thresh_inv = cv2.bitwise_not(thresh)
    
    # Détection de Contours Canny
    # Les seuils sont ajustés pour les images de livres.
    edged = cv2.Canny(thresh_inv, 50, 200, apertureSize=3)

    # 2. Localisation de la Forme
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    # Trier par taille décroissante et prendre les 10 plus grands
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

    page_contour = None
    
    # Itérer sur les contours pour trouver un quadrilatère à 4 points (la page)
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)

        # Si le polygone a 4 points, c'est notre page
        if len(approx) == 4:
            page_contour = approx
            break
            
    if page_contour is None:
        print("Avertissement : Aucun contour de page à 4 points trouvé. Traitement de l'image entière.")
        return image
    
    # 3. Perspective Transform (Redressement)
    print("Succès de la détection de page. Redressement...")
    
    # Appliquer la transformation de perspective en utilisant les 4 coins trouvés
    warped = four_point_transform(image, page_contour.reshape(4, 2))
    
    return warped

# --- FONCTION D'OPTIMISATION FINALE ---

def obtenir_dpi_fichier(chemin_entree):
    """Tente d'obtenir le DPI (x et y) à partir des métadonnées du fichier."""
    # (Fonction inchangée)
    try:
        img_pil = Image.open(chemin_entree)
        if 'dpi' in img_pil.info:
            return img_pil.info['dpi'][0]
        else:
            return 0
    except Exception as e:
        print(f"Erreur lors de la lecture des métadonnées DPI: {e}")
        return 0

def traiter_document_pour_ocr(chemin_entree, chemin_sortie="image_optimisee.png", resolution_cible=300):
    """
    Traite une image en détectant la page, en la redimensionnant au DPI cible, puis en la binarisant.
    """
    
    # 1. Chargement de l'image
    image = cv2.imread(chemin_entree)
    if image is None:
        print(f"Erreur : Impossible de charger l'image à l'adresse {chemin_entree}")
        return

    # 2. Détection et Recadrage/Redressement Automatique
    image_redressee = detect_and_crop_page(image)
    
    # 3. Détection de la résolution initiale (Après redressement pour plus de précision)
    resolution_initiale = obtenir_dpi_fichier(chemin_entree)
    print(f"DPI du fichier d'entrée: {resolution_initiale} DPI.")

    # 4. Conversion en niveaux de gris (sur l'image recadrée)
    gris = cv2.cvtColor(image_redressee, cv2.COLOR_BGR2GRAY)
    
    # 5. Redimensionnement Conditionnel
    if resolution_initiale > 0 and resolution_initiale < resolution_cible:
        facteur_agrandissement = resolution_cible / resolution_initiale
        
        gris = cv2.resize(gris, None, 
                          fx=facteur_agrandissement, 
                          fy=facteur_agrandissement, 
                          interpolation=cv2.INTER_LINEAR)
        
        print(f"Redimensionnement appliqué par un facteur de {facteur_agrandissement:.2f} pour atteindre {resolution_cible} DPI.")
    elif resolution_initiale == 0:
        # Si le DPI est inconnu (0), on ne redimensionne pas pour éviter une mauvaise interpolation
        print("DPI inconnu (0). Redimensionnement ignoré.")


    # 6. Amélioration et Binarisation (pour l'OCR)
    flou = cv2.GaussianBlur(gris, (3, 3), 0)
    
    # Seuil adaptatif pour gérer les variations de lumière sur la page
    binarisee = cv2.adaptiveThreshold(flou, 255, 
                                      cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY, 
                                      15, 5) # Taille du bloc et soustraction de C ajustables

    # 7. Sauvegarde de l'image optimisée
    cv2.imwrite(chemin_sortie, binarisee)
    print(f"Image optimisée (recadrée et binarisée) enregistrée sous : {chemin_sortie}")
    print("\n--- INSTRUCTION TESSERACT RECOMMANDÉE ---")
    print(f"Utilisez le mode 5 pour les doubles colonnes : tesseract {chemin_sortie} - -l fra --psm 5")


# --- Utilisation du script (Exemple) ---
# Décommentez les lignes suivantes pour tester
# chemin_image_entree = "test03.jpg" # Remplacer par le chemin de votre fichier
# chemin_image_sortie = "test03_auto_traite.png"
# traiter_document_pour_ocr(chemin_image_entree, chemin_image_sortie)