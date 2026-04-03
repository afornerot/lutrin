import os
import time
import uuid

from functools import wraps
from flask import Flask, Response, jsonify, send_from_directory, url_for, request, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from services import ocr_image, generate_tts, BigTitle, db_service, ocr_service, password_service, tts_service, epub_service, piper_voices, register_service, user_db_service, user_service, epub_db_service
from config import UPLOAD_FOLDER, FLASK_PORT

# Configuration de Flask
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # 50 Mégaoctets

BigTitle("API Lutrin démarré")
db_service.init_db()
ocr_service.init_ocr_engine()
tts_service.init_tts_engine()

# Activation de CORS pour toutes les routes
CORS(app)

# --- Décorateur pour la protection par clé d'API ---
def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({"error": "Clé d'API manquante dans l'en-tête 'X-API-Key'"}), 401

        user = user_db_service.get_user_by_api_key(api_key)
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
        
        user = user_db_service.get_user_by_api_key(api_key)
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

@app.route('/auth/login', methods=['POST'])
def login():
    """Authentifie un utilisateur et retourne une clé d'API."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Nom d'utilisateur et mot de passe requis"}), 400

    auth_result = user_db_service.authenticate_user(username, password)
    if auth_result:
        return jsonify({"status": "success", **auth_result})
    else:
        return jsonify({"error": "Identifiants invalides"}), 401

@app.route('/register/request', methods=['POST'])
def register_request():
    """
    Endpoint pour demander un lien magique d'inscription.
    """
    data = request.get_json()
    email = data.get('email')
    username = data.get('username')

    if not email:
        return jsonify({"error": "L'adresse e-mail est requise."}), 400

    if not username:
        return jsonify({"error": "Le login est requis."}), 400

    success, message = register_service.request_register(username, email)
    if success:
        return jsonify({"status": "success", "message": message}), 200
    else:
        return jsonify({"error": message}), 400

@app.route('/register/validate', methods=['POST'])
def register_validate():
    """
    Endpoint pour valider le lien magique d'inscription.
    """
    data = request.get_json()
    token = data.get('token')
    password = data.get('password')

    success, message = register_service.validate_register(token,password)
    if success:
        return jsonify({"status": "success", "message": message}), 200
    else:
        return jsonify({"error": message}), 400

@app.route('/password/request', methods=['POST'])
def password_request():
    """
    Endpoint pour demander un lien de réinitialisation de mot de passe.
    """
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "L'adresse e-mail est requise."}), 400

    # On retourne toujours un succès pour ne pas révéler si un email existe.
    success, message = password_service.request_password(email)
    return jsonify({"status": "success", "message": message}), 200

@app.route('/password/validate', methods=['POST'])
def password_validate():
    """
    Endpoint pour valider le token et réinitialiser le mot de passe.
    """
    data = request.get_json()
    token = data.get('token')
    password = data.get('password')

    success, message = password_service.validate_password(token, password)
    if success:
        return jsonify({"status": "success", "message": message}), 200
    else:
        return jsonify({"error": message}), 400

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

    if not text:
        return jsonify({"error": "Le texte est requis."}), 400

    tts_engine = data.get('tts_engine', 'piper')
    piper_model_name = data.get('piper_model_name') # Récupérer le nom du modèle
    length_scale = data.get('length_scale') # Récupérer la vitesse de la voix
    user_id = g.user['id'] if g.user else None

    # Générer un nom de fichier unique pour l'audio
    audio_filename = f"audio_{user_id}_{uuid.uuid4().hex[:6]}_{int(time.time())}.wav"

    success, result = generate_tts(text, audio_filename, tts_engine, user_id, piper_model_name, length_scale)

    if success:
        return jsonify({"audio_url": f"/file/{os.path.basename(result)}"})
    else:
        return jsonify({"error": "Échec de la génération TTS", "details": result}), 500


@app.route('/tts/piper-models', methods=['GET'])
@api_key_required
def get_piper_models():
    """Retourne la liste des modèles Piper disponibles."""
    return jsonify({"models": list(piper_voices.keys())})

@app.route('/file/<path:filename>')
def serve_file(filename):
    """
    Sert un fichier depuis le dossier UPLOAD_FOLDER.
    """

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/epub/add', methods=['POST'])
@api_key_required
def add_epub():
    """
    Upload un fichier EPUB et lance son traitement, avec gestion des exceptions.
    """
    try:
        # --- 1. Vérifications Client ---
        if 'epub_file' not in request.files:
            return jsonify({"error": "Aucun fichier EPUB n'a été envoyé (champ 'epub_file')"}), 400
        
        file = request.files['epub_file']
        if file.filename == '':
            return jsonify({"error": "Aucun fichier sélectionné"}), 400

        # Vérification de l'extension .epub
        if not file.filename.lower().endswith('.epub'):
            return jsonify({"error": "Le fichier doit être au format .epub"}), 400
        
        # --- 2. Appel du Service (où l'erreur 500 se produit) ---
        success, data_or_error = epub_service.add_epub(file, g.user['id'])

        # --- 3. Gestion du Résultat du Service (False/True) ---
        if success:
            return jsonify({"status": "success", "data": data_or_error})
        else:
            # Erreur gérée par le service (ex: EPUB invalide)
            return jsonify({"error": "Le traitement de l'EPUB a échoué", "details": data_or_error}), 500

    # --- 4. Capture des Erreurs Internes Imprévues ---
    except Exception as e:
        # ⚠️ Ceci logue la trace complète de l'erreur dans les logs Gunicorn/Flask
        app.logger.error(f"Erreur interne lors de l'upload de l'EPUB pour l'utilisateur {g.user['id']}: {str(e)}", exc_info=True)
        
        # Retourne une erreur générique au client pour des raisons de sécurité, 
        # tout en vous fournissant la trace complète dans les logs du serveur.
        return jsonify({
            "error": "Une erreur interne inattendue s'est produite lors du traitement du fichier.",
            "details": f"Veuillez consulter les logs du serveur pour l'erreur: {type(e).__name__}"
        }), 500

@app.route('/library/list', methods=['GET'])
@api_key_required
def list_library():
    """
    Retourne la liste de tous les livres de la bibliothèque centrale (sans le texte, avec thumbnails).
    """
    
    epubs = epub_db_service.get_all_epubs(with_text=False)
    return jsonify({"status": "success", "data": epubs})

@app.route('/library/get/<int:epub_id>', methods=['GET'])
@api_key_required
def get_library_epub(epub_id):
    """
    Retourne les données complètes d'un livre (texte + couverture HD) pour l'import.
    """
    epubs = epub_db_service.get_all_epubs(with_text=True)
    epub = next((e for e in epubs if e['id'] == epub_id), None)
    if not epub:
        return jsonify({"error": "Livre non trouvé"}), 404
    return jsonify({"status": "success", "data": epub})

@app.route('/library/add-from-file', methods=['POST'])
@admin_required
def add_library_from_file():
    """
    Traite un fichier EPUB et l'ajoute directement à la base de données centrale.
    Cette route est réservée aux administrateurs.
    """
    if 'epub_file' not in request.files:
        return jsonify({"error": "Aucun fichier EPUB n'a été envoyé (champ 'epub_file')"}), 400
    
    file = request.files['epub_file']
    if file.filename == '' or not file.filename.lower().endswith('.epub'):
        return jsonify({"error": "Fichier invalide ou non sélectionné"}), 400

    success, data_or_error = epub_service.add_epub(file, g.user['id'])

    if not success:
        return jsonify({"error": "Le traitement de l'EPUB a échoué", "details": data_or_error}), 500

    new_id = epub_db_service.add_epub(data_or_error)
    if new_id:
        return jsonify({"status": "success", "message": f"Livre ajouté à la bibliothèque avec l'ID {new_id}", "id": new_id})
    else:
        return jsonify({"error": "Le traitement a réussi mais l'ajout à la base de données a échoué."}), 500


@app.route('/library/add-from-json', methods=['POST'])
@admin_required
def add_library_from_json():
    """
    Ajoute un livre à la bibliothèque centrale à partir de données JSON déjà traitées.
    Cette route est réservée aux administrateurs.
    """

    epub_data = request.get_json()
    if not epub_data or 'metadata' not in epub_data or 'text' not in epub_data:
        return jsonify({"error": "Données JSON invalides ou manquantes."}), 400

    new_id = epub_db_service.add_epub(epub_data)
    if new_id:
        return jsonify({"status": "success", "message": f"Livre ajouté à la bibliothèque avec l'ID {new_id}", "id": new_id})
    else:
        return jsonify({"error": "L'ajout à la base de données de la bibliothèque a échoué."}), 500

@app.route('/library/update/<int:epub_id>', methods=['POST'])
@admin_required
def update_library(epub_id):
    """
    Met à jour les métadonnées d'un livre dans la bibliothèque centrale.
    Cette route est réservée aux administrateurs.
    """

    update_data = request.get_json()
    if not update_data:
        return jsonify({"error": "Aucune donnée de mise à jour fournie."}), 400

    success = epub_db_service.update_epub(epub_id, update_data)
    if success:
        return jsonify({"status": "success", "message": f"Livre ID {epub_id} mis à jour."})
    else:
        return jsonify({"error": f"Impossible de mettre à jour le livre ID {epub_id}."}), 404

@app.route('/library/delete/<int:epub_id>', methods=['POST']) # On utilise POST pour éviter les blocages de proxy
@admin_required
def delete_library(epub_id):
    """
    Supprime un livre de la bibliothèque centrale par son ID.
    Cette route est réservée aux administrateurs.
    """

    success = epub_db_service.delete_epub(epub_id)
    if success:
        return jsonify({"status": "success", "message": f"Livre ID {epub_id} supprimé de la bibliothèque."})
    else:
        return jsonify({"error": f"Impossible de supprimer le livre ID {epub_id}. Il n'existe peut-être pas."}), 404

@app.route('/user/list', methods=['GET'])
@admin_required
def list_user():
    """
    Liste tous les utilisateurs. Réservé aux administrateurs.
    """

    users, message = user_service.get_all_users()
    if users is not None:
        return jsonify({"status": "success", "users": users})
    else:
        return jsonify({"error": message}), 500

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

    api_key = user_db_service.get_api_key_by_username(username)
    if api_key:
        return jsonify({"status": "success", "username": username, "api_key": api_key})
    else:
        return jsonify({"error": f"Utilisateur '{username}' non trouvé"}), 404

@app.route('/user/add', methods=['POST'])
@admin_required
def add_user():
    """
    Ajoute un nouvel utilisateur. Réservé aux administrateurs.
    """
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    role = data.get('role', 'USER')

    success, message = user_service.add_user(username, password, email, role)
    if success:
        return jsonify({"status": "success", "message": message}), 201
    else:
        return jsonify({"error": message}), 400

@app.route('/user/update/<int:user_id>', methods=['POST'])
@admin_required
def update_user(user_id):
    """
    Modifie un utilisateur existant. Réservé aux administrateurs.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour."}), 400

    # On ne garde que les champs autorisés pour la mise à jour
    allowed_updates = {k: v for k, v in data.items() if k in ['username', 'email', 'password', 'role', 'is_active']}

    success, message = user_service.update_user(user_id, allowed_updates)
    if success:
        return jsonify({"status": "success", "message": message})
    else:
        return jsonify({"error": message}), 404 if "trouvé" in message else 500

@app.route('/user/delete/<int:user_id>', methods=['POST'])
@admin_required
def delete_user(user_id):
    """
    Supprime un utilisateur. Réservé aux administrateurs.
    """
    success, message = user_service.delete_user(user_id)
    if success:
        return jsonify({"status": "success", "message": message}), 200
    else:
        return jsonify({"error": message}), 404

# Lancement du serveur de production Waitress sur toutes les interfaces (0.0.0.0)
if __name__ == '__main__':   
    print(f"INFO: Démarrage du serveur API en HTTP sur le port {FLASK_PORT} (derrière le reverse proxy)")
    app.run(host='0.0.0.0', port=FLASK_PORT, debug=True)
