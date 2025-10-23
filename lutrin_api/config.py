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

TESSERACT_CMD = os.getenv('TESSERACT_CMD', '/usr/bin/tesseract')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000)) 

# Configuration du chemin Tesseract pour l'interface Python
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# Création du répertoire de stockage s'il n'existe pas
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
