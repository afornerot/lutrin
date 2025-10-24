import io
import os
import wave

from groq import Groq
from piper.voice import PiperVoice
from google import genai
from google.genai import types
from .logger_service import *
from config import UPLOAD_FOLDER, PIPER_MODEL, TTS_IA, GROQ_TOKEN, GEMINI_TOKEN

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
elif TTS_IA == 'groq':
    Info("Initialisation TTS = Groq")
elif TTS_IA == 'gemini':
    Info("Initialisation TTS = Gemini")

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

def _generate_tts_groq(text, audio_filename):
    """
    Génère un fichier audio .mp3 à partir du texte en utilisant Groq.
    """

    # Traitement du texte par Groq
    Title("Traitement du texte par Groq")
    try:

        client = Groq(api_key=GROQ_TOKEN)

        model = "playai-tts"
        voice = "Fritz-PlayAI"
        response_format = "wav"

        response = client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            response_format=response_format
        )

        response.write_to_file(os.path.join(UPLOAD_FOLDER, audio_filename))

        Success(f"Fichier audio généré = {audio_filename}")
        return True, audio_filename
    except Exception as e:
        error_msg = f"Erreur lors de la génération TTS avec Groq: {repr(e)}"
        Error(error_msg)
        return False, error_msg

def _generate_tts_gemini(text, audio_filename):
    """
    Génère un fichier audio (WAV par défaut) à partir du texte en utilisant l'API Gemini TTS.
    La langue française est détectée automatiquement.
    """

    # Traitement du texte par Gemini
    Title("Traitement du texte par Gemini TTS")
    
    output_filename = audio_filename.replace('.mp3', '.wav').replace('.MP3', '.wav')
    output_path = os.path.join(UPLOAD_FOLDER, output_filename)
    
    try:
        # Instancie le client Gemini
        client = genai.Client(api_key=GEMINI_TOKEN)

        # 1. Définir le contenu (texte en français)
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=text), # Texte à synthétiser
                ],
            ),
        ]
        
        # 2. Configurer la requête TTS
        generate_content_config = types.GenerateContentConfig(
            # Le TTS utilise la modalité 'audio'
            response_modalities=[
                "audio",
            ],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        # Le nom de la voix (e.g., "Zephyr") est requis.
                        # Le modèle Gemini gère la prononciation française
                        # avec le texte français fourni.
                        voice_name="Zephyr" 
                    )
                )
            ),
        )

        # 3. Streamer et écrire le fichier audio
        with open(output_path, "wb") as f:
            for chunk in client.models.generate_content_stream(
                model="gemini-2.5-pro-preview-tts",
                contents=contents,
                config=generate_content_config,
            ):
                # Récupérer les parties audio du chunk
                if (
                    chunk.candidates 
                    and chunk.candidates[0].content 
                    and chunk.candidates[0].content.parts 
                    and chunk.candidates[0].content.parts[0].inline_data
                ):
                    data_buffer = chunk.candidates[0].content.parts[0].inline_data.data
                    f.write(data_buffer)

        Success(f"Fichier audio généré = {output_path} (WAV probable)")
        return True, output_path
    except AttributeError:
        error_msg = f"Erreur de configuration: Assurez-vous que 'config.GEMINI_KEY' est défini."
        Error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Erreur lors de la génération TTS avec Gemini: {repr(e)}"
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

    if TTS_IA == 'groq':
        return _generate_tts_groq(text, audio_filename)
    elif TTS_IA == 'gemini':
        return _generate_tts_gemini(text, audio_filename)
    elif TTS_IA == 'piper':
        return _generate_tts_piper(text, audio_filename)
