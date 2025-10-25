import os
import wave
import requests

from piper.voice import PiperVoice
from .logger_service import *
from config import UPLOAD_FOLDER, PIPER_MODEL, TTS_IA, COQUI_TTS_URL

# Initialisation du modèle TTS (chargé une seule fois au démarrage)
voice = None
if TTS_IA == 'piper':
    Info(f"Initialisation TTS = Piper")
    if os.path.exists(PIPER_MODEL):
        try:
            voice = PiperVoice.load(PIPER_MODEL)
        except Exception as e:
            Error(f"Impossible de charger le modèle TTS Piper. Détails: {e}")
    else:
        Error(f"Modèle TTS Piper non trouvé à l'emplacement = {PIPER_MODEL}") 
elif TTS_IA == 'coqui':
    Info("Initialisation TTS = Coqui")

def _delete_old_files():
    """
    Point d'entrée pour supprimer les anciens fichiers de résultat Audtio.
    """

    Title("Nettoyage des anciens fichiers de résultat Audio")

    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith('audio_') and (filename.endswith('.wav') or filename.endswith('.mp3')):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {filename} = {e}")

def _generate_tts_piper(text, audio_filename):
    """
    Génère un fichier audio .wav à partir du texte en utilisant Piper TTS.
    """

    if not voice:
        return False, "Le service TTS n'est pas initialisé car le modèle est manquant."
    
    # Traitement du texte par Pipper
    Title("Traitement du texte par Piper")
    try:
        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
        with wave.open(audio_path, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)

        Success(f"Fichier audio généré = {audio_path}")
        return True, audio_path
    except Exception as e:
        error_msg = f"Erreur lors de la génération TTS avec Piper: {repr(e)}"
        Error(error_msg)
        return False, error_msg

def _generate_tts_coqui(text, audio_filename):
    """
    Génère un fichier audio .wav à partir du texte en utilisant l'API Coqui TTS.
    """
    Title("Traitement du texte par Coqui TTS")
    try:
        # L'API Coqui XTTS nécessite un speaker_id et une langue.
        # 'fr' pour le français. Le speaker_id est un exemple, à adapter si besoin.
        payload = {
            "text": text,
            "speaker_id": "Viktor Eka",
            "language_id": "fr"
        }
        response = requests.post(f"{COQUI_TTS_URL}/api/tts", data=payload)
        response.raise_for_status() # Lève une exception si le statut est une erreur (4xx ou 5xx)
        
        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
        with open(audio_path, 'wb') as f:
            f.write(response.content)
            
        Success(f"Fichier audio généré = {audio_path}")
        return True, audio_path
    except requests.exceptions.RequestException as e:
        error_msg = f"Erreur de connexion à l'API Coqui TTS: {e}. Le service est-il démarré ('make start') ?"
        Error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Erreur lors de la génération TTS avec Coqui: {repr(e)}"
        Error(error_msg)
        return False, error_msg
    
def generate_tts(text, audio_filename):
    """
    Aiguilleur principal pour le service TTS.
    """

    BigTitle(f"Traitement TTS")

    # Suppression des anciens fichiers audio
    _delete_old_files()

    if not text or not text.strip():
        return False, "Le texte fourni est vide."

    if TTS_IA == 'piper':
        return _generate_tts_piper(text, audio_filename)
    elif TTS_IA == 'coqui':
        return _generate_tts_coqui(text, audio_filename)
