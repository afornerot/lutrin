import os
import time
import uuid

from flask import Flask, Response, jsonify, send_from_directory, url_for, request
from flask_cors import CORS
from waitress import serve
from services import camera_video, camera_image, ocr_image, generate_tts, BigTitle     
from config import UPLOAD_FOLDER, FLASK_PORT

# Configuration de Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Activation de CORS pour toutes les routes
CORS(app)

@app.route('/status')
def status():
    """
    Vérifie l'état de l'API.
    """

    return jsonify({
        "status": "online",
        "api_name": "Lutrin Pi API",
        "version": "1.0",
    })

@app.route('/video')
def video():
    """
    Fournit le flux vidéo MJPEG en continu (Service Caméra).
    """

    return Response(camera_video(),
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
    
    success, result_path_or_error = camera_image(img_filename)
    
    if not success:
        return jsonify({"error": "Capture échouée", "details": result_path_or_error}), 500

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
    image_filename = data.get('image_filename')
    ocr_engine = data.get('ocr_engine', 'paddle') # 'paddle' par défaut

    if not image_filename:
        return jsonify({"error": "Le paramètre 'image_filename' est manquant"}), 400

    image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
    if not os.path.exists(image_path):
        return jsonify({"error": "Le fichier image est introuvable sur le serveur"}), 404

    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    text_filename = f"ocr_result_{unique_id}_{timestamp}.txt"

    recognized_text, text_path_or_error = ocr_image(image_path, text_filename, ocr_engine_choice=ocr_engine)
    if not recognized_text and text_path_or_error: # Si l'OCR a échoué
        return jsonify({"error": "L'OCR a échoué", "details": text_path_or_error}), 500

    return jsonify({"status": "success", "text": recognized_text, "text_filename": text_filename, "text_url": url_for('serve_file', filename=text_filename, _external=True)})

@app.route('/tts', methods=['POST']) # Étape 3: TTS
def process_tts():
    """
    Prend du texte en entrée, génère un fichier audio et retourne ses informations.
    """

    data = request.get_json()
    text = data.get('text')
    tts_engine = data.get('tts_engine', 'coqui') # 'coqui' par défaut

    if not text:
        return jsonify({"error": "Le paramètre 'text' est manquant"}), 400

    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    audio_filename = f"audio_{unique_id}_{timestamp}.wav"

    tts_success, audio_path_or_error = generate_tts(text, audio_filename, tts_engine=tts_engine)
    if not tts_success:
        return jsonify({"error": "La génération TTS a échoué", "details": audio_path_or_error}), 500

    # Le nom de fichier peut avoir changé (ex: .wav -> .mp3), on le récupère depuis le chemin retourné
    final_audio_filename = os.path.basename(audio_path_or_error)

    return jsonify({
        "status": "success",
        "audio_filename": final_audio_filename,
        "audio_path_local": audio_path_or_error,
        "audio_url": url_for('serve_file', filename=final_audio_filename, _external=True)
    })

@app.route('/file/<path:filename>')
def serve_file(filename):
    """
    Sert un fichier depuis le dossier UPLOAD_FOLDER.
    """

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Lancement du serveur de production Waitress sur toutes les interfaces (0.0.0.0)
if __name__ == '__main__':
    BigTitle("Serveur Lutrin démarré")
    serve(app, host='0.0.0.0', port=FLASK_PORT, threads=6)
