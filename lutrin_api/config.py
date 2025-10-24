# Contient les variables de configuration de l'application chargées via python-dotenv.
from dotenv import load_dotenv, find_dotenv
import os

# Charger le fichier .env de base. find_dotenv() le cherche dans les répertoires parents.
load_dotenv(find_dotenv('.env'))

# Charger le fichier .env.local pour surcharger les valeurs.
load_dotenv(find_dotenv('.env.local'), override=True)

# Base dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Chemin vers le modèle TTS Piper. Assurez-vous de télécharger le modèle et de le placer dans lutrin_api/models/
TTS_MODEL_RELATIVE = os.getenv('TTS_MODEL', 'models/fr_FR-siwis-medium.onnx')
TTS_MODEL = os.path.join(BASE_DIR, TTS_MODEL_RELATIVE)

# Activer ou non le moteur d'IA pour l'OCR. Convertit la variable d'env en booléen.
OCR_IA_USE = os.getenv('OCR_IA_USE', 'false').lower() in ('true', '1', 'yes')

# Jeton pour un service OCR externe
OCR_IA_TOKEN = os.getenv('OCR_IA_TOKEN', '')

# Port de communication flask
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000)) 

# Définir le chemin des uploads
UPLOAD_FOLDER = os.path.join(BASE_DIR, '../lutrin_data/')

# Création du répertoire de stockage s'il n'existe pas
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
