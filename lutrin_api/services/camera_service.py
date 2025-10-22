# lutrin_api/services/camera_service.py

import cv2
import threading
import time
import os
from config import CAPTURE_WIDTH, CAPTURE_HEIGHT, UPLOAD_FOLDER

camera = None
camera_lock = threading.Lock()

def get_camera():
    """
    Gère l'initialisation de la caméra (OpenCV) une seule fois.
    """
    
    global camera
    with camera_lock:
        if camera is None:
            # Index 0 pour la caméra par défaut (la webcam USB)
            camera = cv2.VideoCapture(0)
            # Tente de régler une résolution plus faible pour le streaming
            # Pour une bonne fluidité du streaming sur RPi 3
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH/2)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT/2)
            time.sleep(1) # Laisse le temps à la caméra de s'initialiser
            if not camera.isOpened():
                 print("Erreur: Impossible d'ouvrir la caméra, le streaming sera désactivé.")
                 camera = None
    return camera

def generate_frames():
    """
    Fonction de générateur pour le streaming Motion JPEG.
    Envoie des images JPEG successives au client.
    """
    
    cam = get_camera()
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
                    # Si la lecture échoue, casser la boucle
                    print("Échec de la lecture de la frame pour le streaming.")
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
            print(f"Erreur de streaming: {e}")
            break


def capture_image_from_webcam(filename):
    """
    Capture une image à haute résolution en réutilisant l'instance globale.
    """
    
    cam = get_camera()
    if cam is None:
        return False, "Erreur: Impossible d'ouvrir ou de récupérer la caméra."

    # Acquérir le verrou pour garantir un accès exclusif à la caméra
    with camera_lock:
        try:
            # Tenter de régler la haute résolution sur l'instance globale AVANT la capture
            print(f"Réglage de la résolution sur {CAPTURE_WIDTH}x{CAPTURE_HEIGHT} pour la capture.")
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)
    
            # Laisser le temps au pilote de s'adapter
            time.sleep(0.5) # Augmenté pour plus de stabilité
    
            success, frame = cam.read()
            if not success:
                return False, "Échec de la lecture de la frame en haute résolution."
            
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            cv2.imwrite(filepath, frame)
            print(f"Image haute résolution sauvegardée sur {filepath}")
    
            # Réinitialiser la caméra en basse résolution pour le streaming
            print("Réinitialisation de la résolution à 640x480 pour le streaming.")
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH/2)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT/2)
            
            return True, filepath
        except Exception as e:
            return False, f"Erreur lors de la capture/sauvegarde: {e}"
