# Contient les variables de configuration de l'application chargées via python-dotenv.
from dotenv import load_dotenv, find_dotenv
import os

# Charger le fichier .env de base. find_dotenv() le cherche dans les répertoires parents.
load_dotenv(find_dotenv('.env'))

# Charger le fichier .env.local pour surcharger les valeurs.
load_dotenv(find_dotenv('.env.local'), override=True)

# Base dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Chemin vers le modèle TTS Piper
PIPER_MODEL_RELATIVE = os.getenv('PIPER_MODEL', 'models/fr_FR-siwis-medium.onnx')
PIPER_MODEL = os.path.join(BASE_DIR, PIPER_MODEL_RELATIVE)

# Moteur OCR/TTS à utiliser
OCR_IA = os.getenv('OCR_IA', 'paddle').lower()
TTS_IA = os.getenv('TTS_IA', 'coqui').lower()

# Jeton
GROQ_TOKEN = os.getenv('GROQ_TOKEN', '')
COQUI_TTS_URL = os.getenv('COQUI_TTS_URL', 'http://localhost:5002')

# Port de communication flask
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000)) 

# Définir le chemin des uploads
UPLOAD_FOLDER = os.path.join(BASE_DIR, '../lutrin_data/')

# Création du répertoire de stockage s'il n'existe pas
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
