#!/bin/bash
set -e

# Le venv de l'image Idiap contient coqui-tts (+ torch installé par le Dockerfile)
# On se place hors de /app pour ne pas masquer le package TTS par les sources
# présentes dans l'image de base.
cd /root

MODEL="${COQUI_MODEL:-tts_models/multilingual/multi-dataset/xtts_v2}"
EXTRA_ARGS=""

DIR_NAME="${MODEL//\//--}"

if [[ "$MODEL" == *"xtts"* ]] && [[ -f "/root/.local/share/tts/${DIR_NAME}/config.json" ]]; then
    EXTRA_ARGS="--config_path /root/.local/share/tts/${DIR_NAME}/config.json --model_path /root/.local/share/tts/${DIR_NAME}"
fi

exec /opt/venv/bin/python3 -m TTS.server.server --model_name "$MODEL" $EXTRA_ARGS
