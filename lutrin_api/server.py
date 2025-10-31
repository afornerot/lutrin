import os
import time
import uuid
import asyncio

from functools import wraps
import ssl
from flask import Flask, Response, jsonify, send_from_directory, url_for, request, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from waitress import serve
from .services import ocr_image, generate_tts, BigTitle, auth_service, ocr_service, tts_service, epub_service
from .config import UPLOAD_FOLDER, FLASK_PORT

# Configuration de Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Activation de CORS pour toutes les routes
CORS(app)

# --- Décorateur pour la protection par clé d'API ---
def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({"error": "Clé d'API manquante dans l'en-tête 'X-API-Key'"}), 401

        user = auth_service.get_user_by_api_key(api_key)
        if user is None:
            return jsonify({"error": "Clé d'API invalide ou non autorisée"}), 403

        g.user = user  # Stocker l'utilisateur dans le contexte de la requête
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Décorateur pour les routes nécessitant des droits administrateur."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({"error": "Clé d'API manquante"}), 401
        
        user = auth_service.get_user_by_api_key(api_key)
        if user is None or user['role'] != 'ADMIN':
            return jsonify({"error": "Accès non autorisé. Droits administrateur requis."}), 403
        g.user = user
        return f(*args, **kwargs)
    return decorated_function

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

@app.route('/login', methods=['POST'])
def login():
    """Authentifie un utilisateur et retourne une clé d'API."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Nom d'utilisateur et mot de passe requis"}), 400

    api_key = auth_service.authenticate_user(username, password)
    if api_key:
        return jsonify({"status": "success", "api_key": api_key})
    else:
        return jsonify({"error": "Identifiants invalides"}), 401

@app.route('/upload', methods=['POST'])
@api_key_required
def upload_image():
    """
    upload une image sur le serveur
    """

    if 'image' not in request.files:
        return jsonify({"error": "Aucun fichier image n'a été envoyé"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400
    
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]

    # Utilise secure_filename pour la sécurité, même si on le renomme après
    original_filename = secure_filename(file.filename)
    extension = os.path.splitext(original_filename)[1] or '.jpg'
    new_filename = f"capture_{g.user['id']}_{unique_id}_{timestamp}{extension}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
    file.save(filepath)
    
    return jsonify({"status": "success", "image_filename": new_filename})

@app.route('/ocr', methods=['POST']) # Étape 2: OCR
@api_key_required
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
    text_filename = f"ocr_result_{g.user['id']}_{unique_id}_{timestamp}.txt"

    recognized_text, text_path_or_error = ocr_image(image_path, text_filename, ocr_engine_choice=ocr_engine, user_id=g.user['id'])
    if not recognized_text and text_path_or_error: # Si l'OCR a échoué
        return jsonify({"error": "L'OCR a échoué", "details": text_path_or_error}), 500

    return jsonify({"status": "success", "text": recognized_text, "text_filename": text_filename, "text_url": url_for('serve_file', filename=text_filename)})

@app.route('/tts', methods=['POST']) # Étape 3: TTS
@api_key_required
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
    audio_filename = f"audio_{g.user['id']}_{unique_id}_{timestamp}.wav"

    tts_success, audio_path_or_error = generate_tts(text, audio_filename, tts_engine=tts_engine, user_id=g.user['id'])
    if not tts_success:
        return jsonify({"error": "La génération TTS a échoué", "details": audio_path_or_error}), 500

    # Le nom de fichier peut avoir changé (ex: .wav -> .mp3), on le récupère depuis le chemin retourné
    final_audio_filename = os.path.basename(audio_path_or_error)

    return jsonify({
        "status": "success",
        "audio_filename": final_audio_filename,
        "audio_path_local": audio_path_or_error,
        "audio_url": url_for('serve_file', filename=final_audio_filename)
    })

@app.route('/file/<path:filename>')
def serve_file(filename):
    """
    Sert un fichier depuis le dossier UPLOAD_FOLDER.
    """

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/user/get-api-key', methods=['POST'])
@admin_required
def get_user_api_key():
    """
    Retourne la clé d'API pour un utilisateur donné
    """

    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({"error": "Le nom d'utilisateur est manquant"}), 400

    api_key = auth_service.get_api_key_by_username(username)
    if api_key:
        return jsonify({"status": "success", "username": username, "api_key": api_key})
    else:
        return jsonify({"error": f"Utilisateur '{username}' non trouvé"}), 404

@app.route('/epub/add', methods=['POST'])
@api_key_required
def add_new_epub():
    """
    Upload un fichier EPUB et lance son traitement.
    """
    if 'epub_file' not in request.files:
        return jsonify({"error": "Aucun fichier EPUB n'a été envoyé (champ 'epub_file')"}), 400
    
    file = request.files['epub_file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    # Vérification de l'extension .epub
    if not file.filename.lower().endswith('.epub'):
        return jsonify({"error": "Le fichier doit être au format .epub"}), 400

    success, data_or_error = epub_service.add_epub(file, g.user['id'])

    if success:
        return jsonify({"status": "success", "data": data_or_error})
    else:
        return jsonify({"error": "Le traitement de l'EPUB a échoué", "details": data_or_error}), 500

# Lancement du serveur de production Waitress sur toutes les interfaces (0.0.0.0)
if __name__ == '__main__':
    BigTitle("Serveur Lutrin démarré")
    ocr_service.init_ocr_engine()
    tts_service.init_tts_engine()

    print(f"INFO: Démarrage du serveur API en HTTP sur le port {FLASK_PORT} (derrière le reverse proxy)")
    serve(app, host='127.0.0.1', port=FLASK_PORT, threads=6)
