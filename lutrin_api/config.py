# Contient les variables de configuration de l'application chargées via python-dotenv.
from dotenv import load_dotenv
import os
import pytesseract

# Charge les variables d'environnement depuis .env et .env.local
load_dotenv(override=True)

# Définir le chemin de base du script (le dossier lutrin_api)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Récupération des variables d'environnement ou utilisation de valeurs par défaut
# UPLOAD_FOLDER utilise un chemin relatif résolu en absolu pour plus de portabilité
UPLOAD_FOLDER_RELATIVE = os.getenv('UPLOAD_FOLDER', '../lutrin_data/')
UPLOAD_FOLDER = os.path.join(BASE_DIR, UPLOAD_FOLDER_RELATIVE)

# Chemin vers le modèle TTS Piper. Assurez-vous de télécharger le modèle et de le placer dans lutrin_api/models/
TTS_MODEL_RELATIVE = os.getenv('TTS_MODEL', 'models/fr_FR-siwis-medium.onnx')
TTS_MODEL = os.path.join(BASE_DIR, TTS_MODEL_RELATIVE)

FLASK_PORT = int(os.getenv('FLASK_PORT', 5000)) 

# Création du répertoire de stockage s'il n'existe pas
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
