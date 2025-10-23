# server.py - Routeur Principal

import os
import time
import uuid
from flask import Flask, Response, jsonify, send_from_directory, url_for, request
from flask_cors import CORS
from waitress import serve

# Importation du module de configuration
from config import (
    UPLOAD_FOLDER, 
    TESSERACT_CMD, 
    FLASK_PORT
)

# Importation des services après la définition des variables de configuration
from services import generate_frames, capture_image_from_webcam, ocr_image, generate_tts_simulation

# Configuration de Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Activation de CORS pour toutes les routes
CORS(app)

@app.route('/status')
def status():
    """Vérifie l'état de l'API."""
    return jsonify({
        "status": "online",
        "api_name": "Lutrin Pi API",
        "version": "1.0",
        "tesseract_cmd": TESSERACT_CMD
    })

@app.route('/video')
def video():
    """Fournit le flux vidéo MJPEG en continu (Service Caméra)."""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/capture', methods=['POST']) # Étape 1: Capture
def capture_image():
    """
    Capture une image depuis la webcam et la sauvegarde.
    Retourne les informations sur le fichier image créé.
    """
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    img_filename = f"capture_{unique_id}_{timestamp}.jpg"
    
    success, result_path_or_error = capture_image_from_webcam(img_filename)
    
    if not success:
        return jsonify({"error": "Capture échouée", "details": result_path_or_error}), 500

    print(f"Image sauvegardée: {result_path_or_error}")
    return jsonify({
        "status": "success",
        "image_filename": img_filename,
        "image_path_local": result_path_or_error,
        "image_url": url_for('serve_file', filename=img_filename, _external=True)
    })

@app.route('/ocr', methods=['POST']) # Étape 2: OCR
def process_ocr():
    """
    Prend un nom de fichier image en entrée, exécute l'OCR et retourne le texte.
    """
    data = request.get_json()
    if not data or 'image_filename' not in data:
        return jsonify({"error": "Le nom du fichier image est manquant"}), 400

    image_path = os.path.join(app.config['UPLOAD_FOLDER'], data['image_filename'])
    if not os.path.exists(image_path):
        return jsonify({"error": "Le fichier image est introuvable sur le serveur"}), 404

    recognized_text = ocr_image(image_path)
    return jsonify({"status": "success", "text": recognized_text})

@app.route('/tts', methods=['POST']) # Étape 3: TTS
def process_tts():
    """
    Prend du texte en entrée, génère un fichier audio et retourne ses informations.
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Le texte est manquant"}), 400

    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    audio_filename = f"audio_{unique_id}_{timestamp}.wav"

    tts_success, audio_path_or_error = generate_tts_simulation(data['text'], audio_filename)
    if not tts_success:
        return jsonify({"error": "La génération TTS a échoué", "details": audio_path_or_error}), 500

    return jsonify({
        "status": "success",
        "audio_filename": audio_filename,
        "audio_path_local": audio_path_or_error,
        "audio_url": url_for('serve_file', filename=audio_filename, _external=True)
    })

@app.route('/file/<path:filename>')
def serve_file(filename):
    """
    Sert un fichier depuis le dossier UPLOAD_FOLDER.
    """

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Lancement du serveur de production Waitress sur toutes les interfaces (0.0.0.0)
if __name__ == '__main__':
    print(f"Serveur Lutrin Pi démarré. Tesseract CMD: {TESSERACT_CMD}")
    serve(app, host='0.0.0.0', port=FLASK_PORT, threads=6)
