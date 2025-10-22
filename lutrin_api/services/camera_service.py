# lutrin_api/services/camera_service.py

import cv2
import time
import os
from config import CAPTURE_WIDTH, CAPTURE_HEIGHT, UPLOAD_FOLDER

camera = None

def get_camera():
    """Gère l'initialisation de la caméra (OpenCV) une seule fois."""
    global camera
    if camera is None:
        # Index 0 pour la caméra par défaut (la webcam USB)
        camera = cv2.VideoCapture(0)
        # Tente de régler une résolution plus faible pour le streaming
        # Pour une bonne fluidité du streaming sur RPi 3
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
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
            # Lire la frame de la caméra
            success, frame = cam.read()
            if not success:
                # Si la lecture échoue, casser la boucle
                break
            else:
                # Encoder l'image en format JPEG
                ret, buffer = cv2.imencode('.jpg', frame)
                if ret:
                    frame = buffer.tobytes()
                    # Retourner la frame sous forme de réponse multipart
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                
                # Petite pause pour ne pas saturer le Pi 3
                time.sleep(0.05) 
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

    try:
        # Tenter de régler la haute résolution sur l'instance globale AVANT la capture
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)

        # Laisser le temps au pilote de s'adapter si possible
        time.sleep(0.1)

        success, frame = cam.read()
        if not success:
            return False, "Échec de la lecture de la frame."
        
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        cv2.imwrite(filepath, frame)

        # Réinitialiser la caméra en basse résolution pour le streaming
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        return True, filepath

    except Exception as e:
        return False, f"Erreur lors de la capture/sauvegarde: {e}"
