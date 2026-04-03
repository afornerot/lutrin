#!/bin/bash
set -e

MODEL="${COQUI_MODEL:-tts_models/multilingual/multi-dataset/xtts_v2}"
EXTRA_ARGS=""

if [[ "$MODEL" == *"xtts"* ]]; then
    DIR_NAME="${MODEL//\//--}"
    EXTRA_ARGS="--config_path /root/.local/share/tts/${DIR_NAME}/config.json --model_path /root/.local/share/tts/${DIR_NAME}"
fi

exec python3 TTS/server/server.py --model_name "$MODEL" $EXTRA_ARGS
