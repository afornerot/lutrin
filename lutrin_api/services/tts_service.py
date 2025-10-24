import io
import os
import wave

from piper.voice import PiperVoice
from .logger_service import *
from config import UPLOAD_FOLDER, TTS_MODEL

# Initialisation du modèle TTS (chargé une seule fois au démarrage)
voice = None
if os.path.exists(TTS_MODEL):
    try:
        voice = PiperVoice.load(TTS_MODEL)
        Info(f"Modèle TTS chargé avec succès = {TTS_MODEL}")
    except Exception as e:
        Error(f"Impossible de charger le modèle TTS. Détails: {e}")
else:
    Error(f"Modèle TTS non trouvé à l'emplacement = {TTS_MODEL}") 

def _delete_old_files():
    """
    Point d'entrée pour supprimer les anciens fichiers de résultat Audtio.
    """

    Title("Nettoyage des anciens fichiers de résultat Audio")

    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith('audio_') and filename.endswith('.wav'):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {filename} = {e}")

def generate_tts(text, audio_filename):
    """
    Génère un fichier audio .wav à partir du texte en utilisant Piper TTS.
    """

    BigTitle(f"Traitement TTS avec Piper")

    # Suppression des anciens fichiers de résultat OCR
    _delete_old_files()
    
    if not voice:
        return False, "Le service TTS n'est pas initialisé car le modèle est manquant."
    
    if not text or not text.strip():
        return False, "Le texte fourni est vide."

    # Traitement du texte par Pipper
    Title("Traitement du texte par Pipper")
    try:
        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
        with wave.open(audio_path, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)

        Success(f"Fichier audio généré = {audio_path}")
        return True, audio_path
    except Exception as e:
        Error(f"Erreur détaillée lors de la génération TTS = {repr(e)}")
        return False, f"Erreur lors de la génération TTS = {e}"
