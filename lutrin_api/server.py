# server.py - Routeur Principal

import os
import time
import uuid
from flask import Flask, Response, jsonify, send_from_directory, url_for
from flask_cors import CORS
from waitress import serve

# Importation du module de configuration
from config import (
    UPLOAD_FOLDER, 
    TESSERACT_CMD, 
    CAPTURE_WIDTH, 
    CAPTURE_HEIGHT, 
    FLASK_PORT
)

# Importation des services après la définition des variables de configuration
from services import generate_frames, capture_image_from_webcam, ocr_image, generate_tts_simulation

# Configuration de Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app) # Activation de CORS pour toutes les routes

@app.route('/status')
def status():
    """Vérifie l'état de l'API."""
    return jsonify({
        "status": "online",
        "api_name": "Lutrin Pi API",
        "version": "1.0",
        "tesseract_cmd": TESSERACT_CMD,
        "capture_res": f"{CAPTURE_WIDTH}x{CAPTURE_HEIGHT}"
    })

@app.route('/video_feed')
def video_feed():
    """Fournit le flux vidéo MJPEG en continu (Service Caméra)."""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture', methods=['POST'])
def capture():
    """
    Capture l'image (Caméra), lance l'OCR (OCR), et simule le TTS (TTS).
    """
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    img_filename = f"capture_{unique_id}_{timestamp}.jpg"
    audio_filename = f"audio_{unique_id}_{timestamp}.wav"
    
    # 1. Capture de l'image (Appel au service)
    success, result_path_or_error = capture_image_from_webcam(img_filename)
    
    if not success:
        return jsonify({"error": "Capture échouée", "details": result_path_or_error}), 500

    print(f"Image sauvegardée: {result_path_or_error}")
    
    # 2. Lancement de l'OCR (Appel au service)
    recognized_text = ocr_image(result_path_or_error) # Corrected variable name here
    
    # 3. Simulation de la Synthèse Vocale (Appel au service)
    tts_success, audio_path_or_error = generate_tts_simulation(recognized_text, audio_filename)
    
    if not tts_success:
        print(f"Avertissement TTS: {audio_path_or_error}")
        # On ne retourne pas une erreur critique car l'OCR a réussi

    # Construire les URLs complètes pour le client
    # url_for est plus robuste car il construit l'URL dynamiquement
    image_url = url_for('serve_file', filename=img_filename, _external=True) if success else None
    audio_url = url_for('serve_file', filename=audio_filename, _external=True) if tts_success else None

    # Retourne les chemins locaux pour vérification et les données pour le client
    return jsonify({
        "status": "success",
        "text": recognized_text,
        "image_path_local": result_path_or_error,
        "audio_path_local": audio_path_or_error if tts_success else None,
        "image_url": image_url,
        "audio_url": audio_url
    })

@app.route('/files/<path:filename>')
def serve_file(filename):
    """Sert un fichier depuis le dossier UPLOAD_FOLDER."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    print(f"Serveur Lutrin Pi démarré. Tesseract CMD: {TESSERACT_CMD}")
    # Lancement du serveur de production Waitress sur toutes les interfaces (0.0.0.0)
    serve(app, host='0.0.0.0', port=FLASK_PORT, threads=6)
