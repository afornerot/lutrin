import os
import wave
import io
import onnxruntime
import requests

from piper.voice import PiperVoice, SynthesisConfig
from google import genai
from google.genai import types
from .logger_service import BigTitle, Title, Error, Success, Log
from config import UPLOAD_FOLDER, PIPER_MODEL, COQUI_TTS_URL, COQUI_MODEL, GOOGLE_TOKEN, GEMINI_TTS_MODEL

# --- Initialisation des modèles TTS (chargés une seule fois au démarrage) ---
voices = {}

def init_tts_engine():
    """Initialise le moteur Piper TTS. Appelé au démarrage du serveur."""
    global voices
    if not voices: # Si le dictionnaire est vide
        # Masquer les avertissements de ONNX Runtime concernant l'absence de GPU
        onnxruntime.set_default_logger_severity(3) # 3 = ERROR
        Log("Initialisation du moteur TTS (Piper)...")
        
        model_dir = os.path.dirname(PIPER_MODEL)
        if not os.path.exists(model_dir):
            Error(f"Le répertoire des modèles Piper '{model_dir}' n'existe pas.")
            return

        for filename in os.listdir(model_dir):
            if filename.endswith(".onnx"):
                model_path = os.path.join(model_dir, filename)
                try:
                    voices[filename] = PiperVoice.load(model_path)
                    Success(f"Modèle Piper '{filename}' chargé avec succès.")
                except Exception as e:
                    Error(f"Impossible de charger le modèle Piper '{filename}'. Détails: {e}")

def _delete_old_files(user_id):
    """
    Supprime les anciens fichiers audio et capture pour un utilisateur spécifique.
    """

    Title(f"Nettoyage des anciens fichiers Audio pour l'utilisateur ID: {user_id}")

    # On parcourt tous les fichiers dans le dossier UPLOAD_FOLDER
    audio_prefix_to_delete = f"audio_{user_id}_"
    capture_prefix_to_delete = f"capture_{user_id}_"

    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith(audio_prefix_to_delete) or filename.startswith(capture_prefix_to_delete):
            try:
                file_path_to_delete = os.path.join(UPLOAD_FOLDER, filename)
                os.remove(file_path_to_delete)
                Log(f"Suppression = {file_path_to_delete}")
            except OSError as e:
                Error(f"Suppression du fichier impossible {filename} = {e}")

def _generate_tts_piper(text, audio_filename, piper_model_name=None, length_scale=1.0):
    """
    Génère un fichier audio .wav à partir du texte en utilisant Piper TTS.
    """
    
    # Sélectionne le modèle demandé, ou le premier disponible par défaut
    selected_model_name = piper_model_name if piper_model_name in voices else next(iter(voices), None)

    if not selected_model_name:
        return False, "Aucun modèle Piper TTS n'est chargé ou disponible."
    voice = voices[selected_model_name]
    
    # Traitement du texte par Pipper
    Title("Traitement du texte par Piper")
    try:
        try:
            scale = float(length_scale)
        except (ValueError, TypeError):
            scale = 1.0 # Valeur par défaut si le paramètre est invalide

        synthesis_config = SynthesisConfig(length_scale=scale)

        # Nettoyage du texte pour supprimer les caractères problématiques
        # Les guillemets français « et » peuvent causer des artefacts sonores.
        cleaned_text = text.replace('»', '"').replace('«', '"')
        Log(f"Texte nettoyé pour Piper : {cleaned_text[:100]}...")

        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
        with wave.open(audio_path, "wb") as wav_file:
            voice.synthesize_wav(cleaned_text, wav_file, synthesis_config)

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
        payload = {"text": text}

        if "xtts" in COQUI_MODEL:
            payload["speaker_id"] = "Viktor Eka"
            payload["language_id"] = "fr"

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

def _generate_tts_gemini(text, audio_filename, voice_name=None):
    """
    Génère un fichier audio .wav à partir du texte en utilisant Gemini TTS.
    """

    Title("Traitement du texte par Gemini TTS")
    
    if not GOOGLE_TOKEN:
        return False, "La clé API Google (GOOGLE_TOKEN) n'est pas configurée."
    
    try:
        client = genai.Client(api_key=GOOGLE_TOKEN)
        
        voice_config = None
        if voice_name:
            voice_config = types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            )
        else:
            voice_config = types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="aoede")
            )
        
        speech_config = types.SpeechConfig(voice_config=voice_config)
        
        response = client.models.generate_content(
            model=GEMINI_TTS_MODEL,
            contents=[text],
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=speech_config
            )
        )
        
        if not response.candidates or not response.candidates[0].content.parts:
            return False, "Aucune donnée audio reçue de Gemini."
        
        part = response.candidates[0].content.parts[0]
        if not hasattr(part, 'inline_data') or not part.inline_data:
            return False, "Aucune donnée audio reçue de Gemini."
        
        audio_data = part.inline_data.data
        
        audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
        
        with wave.open(audio_path, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(audio_data)
            
        Success(f"Fichier audio généré = {audio_path}")
        return True, audio_path
    except Exception as e:
        error_msg = f"Erreur lors de la génération TTS avec Gemini: {repr(e)}"
        Error(error_msg)
        return False, error_msg
    
def generate_tts(text, audio_filename, tts_engine='piper', user_id=None, piper_model_name=None, length_scale=None, voice_name=None):
    """
    Aiguilleur principal pour le service TTS.
    """

    model_info = f" (Modèle: {piper_model_name})" if tts_engine == 'piper' and piper_model_name else ""
    BigTitle(f"Traitement TTS avec le moteur : {tts_engine.upper()}{model_info}")

    if user_id:
        # Suppression des anciens fichiers audio de l'utilisateur
        _delete_old_files(user_id)

    if not text or not text.strip() or len(text.strip()) < 2:
        return False, "Le texte fourni est vide."
    
    if tts_engine == 'piper':
        return _generate_tts_piper(text, audio_filename, piper_model_name, length_scale)
    elif tts_engine == 'coqui':
        return _generate_tts_coqui(text, audio_filename)
    elif tts_engine == 'gemini':
        return _generate_tts_gemini(text, audio_filename, voice_name)
