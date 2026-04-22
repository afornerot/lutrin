# Contient les variables de configuration de l'application chargées via python-dotenv.
from dotenv import load_dotenv, find_dotenv
import os

# Charger le fichier .env de base. find_dotenv() le cherche dans les répertoires parents.
load_dotenv(find_dotenv('.env'))

# Charger le fichier .env.local pour surcharger les valeurs.
load_dotenv(find_dotenv('.env.local'), override=True)

# Base dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Front URL
FRONT_URL=os.getenv('FRONT_URL', 'https://lutrin.terium.org')

# SMTP
MAILER_DSN=os.getenv('MAILER_DSN', 'sendmail://default')

# Configuration Piper
PIPER_MODEL_RELATIVE = os.getenv('PIPER_MODEL', 'models/fr_FR-siwis-medium.onnx')
PIPER_MODEL = os.path.join(BASE_DIR, PIPER_MODEL_RELATIVE)

# Configuration Coqui
COQUI_TTS_URL = os.getenv('COQUI_TTS_URL', 'http://localhost:5002')
COQUI_MODEL = os.getenv('COQUI_MODEL', 'tts_models/multilingual/multi-dataset/xtts_v2')

# Jeton
GROQ_TOKEN = os.getenv('GROQ_TOKEN', '')

# Configuration Gemini TTS
GOOGLE_TOKEN = os.getenv('GOOGLE_TOKEN', '')
GEMINI_TTS_MODEL = os.getenv('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts')

# Port de communication flask
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000)) 

# Définir le chemin des uploads
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(BASE_DIR, '../lutrin_data/'))

# Définir le chemin de la base de données
DATABASE_PATH = os.getenv('DATABASE_PATH', os.path.join(BASE_DIR, '../lutrin_data/database.db'))

# Création du répertoire de stockage s'il n'existe pas
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
