# -*- coding: utf-8 -*-
import os
import io
import time
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS # NOUVEL IMPORT : Gestion des CORS
from PIL import Image
import pytesseract
import cv2
from waitress import serve
# ATTENTION: Assurez-vous d'avoir installé les dépendances via requirements.txt
# et les librairies système (comme tesseract-ocr) sur votre Raspberry Pi.

app = Flask(__name__)
# NOUVELLE LIGNE : Active CORS pour TOUTES les routes (pour l'interface client)
CORS(app) 

# --- Configurations ---
# Mise à jour du chemin UPLOAD_FOLDER pour l'utilisateur 'arno'
UPLOAD_FOLDER = '/home/arno/lutrin_data/'
# Assurez-vous que ce dossier existe sur votre Pi: mkdir -p /home/arno/lutrin_data
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# Initialisation globale de la caméra pour le streaming
# NOTE: Cette variable doit être accessible par generate_frames
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
    Capture une seule image de haute qualité pour l'OCR en réutilisant l'instance de caméra globale.
    """
    global camera
    cam = get_camera()

    if cam is None:
        print("Erreur: L'instance de caméra n'est pas disponible pour la capture.")
        return False
        
    try:
        # Tente de régler la plus haute résolution possible pour l'OCR
        # NOTE : Cela peut échouer si le streaming est déjà en cours à 640x480.
        # Le pilote V4L2 peut ignorer cette demande de changement de résolution à la volée.
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, 1920) 
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
        
        # Pause courte pour que le capteur s'adapte, même si le changement de résolution échoue
        time.sleep(1) 

        # Lecture d'une seule frame
        ret, frame = cam.read()

        # Rétablissez la résolution plus basse après la capture pour le streaming
        # Cela réduit la charge CPU du Pi 3 pour le streaming continu
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        if ret:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            # Sauvegarder l'image capturée
            cv2.imwrite(filepath, frame)
            print(f"Image sauvegardée: {filepath}")
            return filepath
        else:
            print("Erreur: Impossible de lire la frame de la caméra pour la capture.")
            return False
    except Exception as e:
        print(f"Erreur lors de la capture de l'image: {e}")
        return False

# Les fonctions process_ocr et generate_tts_audio restent inchangées...
def process_ocr(image_path):
    """Effectue la Reconnaissance Optique de Caractères (OCR) sur l'image."""
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, lang='fra', config='--psm 6')
        return text.strip()
    except Exception as e:
        return f"Erreur OCR: {e}"

def generate_tts_audio(text, filename):
    """SIMULATION de la fonction de Synthèse Vocale (TTS)."""
    audio_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    with open(audio_path, 'w') as f:
        f.write(f"Audio placeholder for: {text[:50]}...")
    print(f"Audio simulé généré: {audio_path}")
    return audio_path


# --- Routes API ---

@app.route('/status', methods=['GET'])
def get_status():
    """Vérifie l'état de l'API et des composants critiques."""
    return jsonify({
        "status": "online",
        "message": "API du Lutrin Pi est en cours d'exécution.",
        "uptime": time.time()
    })

@app.route('/video_feed')
def video_feed():
    """
    Route de streaming de la webcam (Motion JPEG).
    Le client (navigateur) doit afficher ceci dans un tag <img>:
    <img src="http://[IP_DU_PI]:5000/video_feed" />
    """
    # Renvoie un flux de données multipart pour le streaming vidéo
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/capture', methods=['POST'])
def capture_and_read():
    """
    1. Capture l'image.
    2. Effectue l'OCR.
    3. Lance la génération TTS (simulation).
    4. Renvoie le texte et un lien vers le fichier audio.
    """
    timestamp = int(time.time())
    image_filename = f"capture_{timestamp}.jpg"
    audio_filename = f"audio_{timestamp}.wav" # Le format .wav est standard pour TTS

    # 1. Capture (utilise la fonction de capture haute résolution)
    image_path = capture_image_from_webcam(image_filename)
    if not image_path:
        return jsonify({"error": "Échec de la capture par la caméra."}), 500

    # 2. OCR
    recognized_text = process_ocr(image_path)
    if recognized_text.startswith("Erreur OCR"):
        return jsonify({"error": recognized_text}), 500
    
    if not recognized_text:
        return jsonify({"error": "OCR n'a détecté aucun texte. Vérifiez l'alignement."}), 400

    # 3. TTS (Simulation)
    audio_path = generate_tts_audio(recognized_text, audio_filename)
    audio_url = f"{request.url_root}audio/{audio_filename}"

    return jsonify({
        "success": True,
        "text": recognized_text,
        "audio_url": audio_url,
        "image_file": image_filename,
        "message": "Texte reconnu et audio généré (simulé)."
    })

@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """
    Permet au téléphone de télécharger le fichier audio généré.
    Sert également les images JPG capturées.
    """
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(filepath):
        # Détermine le mimetype en fonction de l'extension
        if filename.endswith('.wav'):
             mimetype = 'audio/wav'
        elif filename.endswith('.jpg'):
             mimetype = 'image/jpeg'
        else:
             mimetype = 'application/octet-stream' # Type par défaut
             
        return send_file(filepath, mimetype=mimetype)
    
    return jsonify({"error": "Fichier non trouvé."}), 404


if __name__ == '__main__':
    print("Démarrage de l'API du Lutrin Pi sur http://0.0.0.0:5000 via Waitress")
    # Utilisation de Waitress (serveur de production léger) pour plus de stabilité et moins de bruit dans les logs
    serve(app, host='0.0.0.0', port=5000, threads=4)
