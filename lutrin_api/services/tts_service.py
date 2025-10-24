# lutrin_api/services/tts_service.py

import io
import os
import wave
from piper.voice import PiperVoice
from config import UPLOAD_FOLDER, TTS_MODEL

# --- Initialisation du modèle TTS (chargé une seule fois au démarrage) ---
voice = None
if os.path.exists(TTS_MODEL):
    print(f"Chargement du modèle TTS depuis : {TTS_MODEL}")
    try:
        voice = PiperVoice.load(TTS_MODEL)
        print("Modèle TTS chargé avec succès.")
    except Exception as e:
        print(f"ERREUR: Impossible de charger le modèle TTS. Détails: {e}")
else:
    print(f"AVERTISSEMENT: Modèle TTS non trouvé à l'emplacement '{TTS_MODEL}'. Le service TTS sera désactivé.")

def generate_tts(text, audio_filename):
    """
    Génère un fichier audio .wav à partir du texte en utilisant Piper TTS.
    """
    
    if not voice:
        return False, "Le service TTS n'est pas initialisé car le modèle est manquant."
    if not text or not text.strip():
        return False, "Le texte fourni est vide."

    try:
        # --- Suppression des anciens fichiers audio ---
        print("Nettoyage des anciens fichiers audio...")
        # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
        for filename in os.listdir(UPLOAD_FOLDER):
            # Si le fichier correspond au pattern des fichiers audio générés
            if filename.startswith('audio_') and filename.endswith('.wav'):
                try:
                    file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                    os.remove(file_path_to_delete)
                    print(f"Ancien fichier audio supprimé : {file_path_to_delete}")
                except OSError as e:
                    # On ne bloque pas le processus si une suppression échoue, on logue juste l'erreur
                    print(f"Erreur lors de la suppression du fichier {filename}: {e}")

        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)

        # Utiliser le chemin complet (audio_path) et le texte fourni (text)
        with wave.open(audio_path, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)

        print(f"Fichier audio généré avec Piper: {audio_path}")
        return True, audio_path
    except Exception as e:
        print(f"Erreur détaillée lors de la génération TTS: {repr(e)}")
        return False, f"Erreur lors de la génération TTS avec Piper: {e}"
