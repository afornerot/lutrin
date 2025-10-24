# lutrin_api/services/camera_service.py

import cv2
import threading
import time
import os
from config import UPLOAD_FOLDER
from .logger_service import *

camera = None
camera_lock = threading.Lock()
max_resolution = None
streaming_resolution = (640, 480)

# Liste des résolutions communes à tester, de la plus haute à la plus basse
RESOLUTIONS_TO_TEST = [
    (3840, 2160),  # 4K UHD
    (2560, 1440),  # 1440p QHD
    (1920, 1080),  # Full HD (1080p)
    (1280, 720),   # HD (720p)
    (640, 480)     # VGA
]

def _determine_max_resolution(cam):
    """
    Détermine la plus haute résolution supportée par la caméra en itérant
    sur une liste prédéfinie. Cette fonction est appelée une seule fois.
    """

    global max_resolution
    Title("Détermination de la résolution maximale de la caméra")
    for width, height in RESOLUTIONS_TO_TEST:
        Log(f"Test de la résolution {width}x{height}")
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        time.sleep(0.2) # Laisse le temps au pilote de s'adapter

        actual_width = int(cam.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(cam.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if actual_width == width and actual_height == height:
            Success(f"Résolution validée {width}x{height}")
            max_resolution = (width, height)
            return
    
    # Si aucune résolution de la liste n'a fonctionné, on utilise une valeur par défaut
    max_resolution = (1280, 720)
    Log(f"Aucune résolution testée n'a fonctionné. Utilisation de la résolution par défaut : {max_resolution}")

def _get_camera():
    """
    Gère l'initialisation de la caméra (OpenCV) une seule fois.
    Détermine la résolution max et configure la résolution de streaming.
    """
    
    global camera
    with camera_lock:
        if camera is None:
            # Index 0 pour la caméra par défaut (la webcam USB)
            camera = cv2.VideoCapture(0)

            if not camera.isOpened():
                 Error("Impossible d'ouvrir la caméra, le streaming sera désactivé.")
                 camera = None
                 return None
            
            # 1. Déterminer la résolution maximale supportée
            _determine_max_resolution(camera)
            
            # 2. Calculer la résolution de streaming en conservant les proportions
            global streaming_resolution
            if max_resolution and max_resolution[0] > 0:
                aspect_ratio = max_resolution[1] / max_resolution[0]
                streaming_width = 640
                streaming_height = int(streaming_width * aspect_ratio)
                streaming_resolution = (streaming_width, streaming_height)
            
            # 3. Configurer la caméra pour la résolution de streaming calculée
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, streaming_resolution[0])
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, streaming_resolution[1])
            time.sleep(0.5) # Laisse le temps à la caméra de s'initialiser
    return camera

def _delete_old_files():
    """
    Point d'entrée pour supprimer les anciens fichiers de résultat Capture.
    """

    Title("Nettoyage des anciennes images de capture")
    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    for f in os.listdir(UPLOAD_FOLDER):
        if f.startswith('capture_') and f.endswith('.jpg'):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, f)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {f} = {e}")

def camera_video():
    """
    Fonction de générateur pour le streaming Motion JPEG.
    Envoie des images JPEG successives au client.
    """
    
    BigTitle("Streaming de la caméra")

    cam = _get_camera()
    if cam is None:
        # Si la caméra n'a pas pu être ouverte, ne rien envoyer.
        yield (b'--frame\r\n'
               b'Content-Type: text/plain\r\n\r\n'
               b'Camera not available\r\n')
        return

    while True:
        try:
            with camera_lock:
                # Lire la frame de la caméra
                success, frame = cam.read()
                if not success:
                    Error("Échec de la lecture de la frame pour le streaming.")
                    break
                else:
                    # Encoder l'image en format JPEG
                    ret, buffer = cv2.imencode('.jpg', frame)
                    if ret:
                        frame_bytes = buffer.tobytes()
                        # Retourner la frame sous forme de réponse multipart
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.03) 
        except Exception as e:
            Error(f"Erreur de streaming: {e}")
            break


def camera_image(filename):
    """
    Capture une image à haute résolution en réutilisant l'instance globale.
    """

    BigTitle("Capture d'une image")

    # Suppression des anciennes images de capture
    _delete_old_files()

    cam = _get_camera()
    if cam is None:
        return False, "Erreur: Impossible d'ouvrir ou de récupérer la caméra."

    # Acquérir le verrou pour garantir un accès exclusif à la caméra
    Title(f"Capture de l'image")
    with camera_lock:
        try:
            # Régler la caméra sur la résolution maximale détectée
            if max_resolution is None:
                return False, "La résolution maximale de la caméra n'a pas été déterminée."
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, max_resolution[0])
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, max_resolution[1])
    
            # Laisser le temps au pilote de s'adapter
            time.sleep(0.5)
    
            # Capturer l'image
            success, frame = cam.read()
            if not success:
                return False, "Échec de la lecture de la frame en haute résolution."
            
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            cv2.imwrite(filepath, frame)
            Success(f"Image capturée = {filepath}")
    
            # Réinitialiser la caméra à la résolution de streaming
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, streaming_resolution[0])
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, streaming_resolution[1])
            
            return True, filepath
        except Exception as e:
            return False, f"Erreur lors de la capture/sauvegarde: {e}"
