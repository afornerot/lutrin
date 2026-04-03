#!/bin/bash
set -e

MODELS=(
    "tts_models/multilingual/multi-dataset/xtts_v2"
    "tts_models/fr/mai/tacotron2-DDC"
    "tts_models/fr/css10/vits"
)

VOLUME_PATH="$(pwd)/lutrin_data/coqui:/root/.local/share/tts/"

download_model() {
    local model="$1"
    local dir_name="${model//\//--}"

    if [ -d "./lutrin_data/coqui/$dir_name" ]; then
        echo "  Model already present: $model"
        return 0
    fi

    echo "  Downloading $model ..."
    echo "y" | docker run --rm -i \
        -v "$VOLUME_PATH" \
        --entrypoint tts \
        ghcr.io/coqui-ai/tts-cpu \
        --model_name "$model" \
        --text "Test." \
        --out_path /tmp/download_test.wav >/dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "  Downloaded successfully."
    else
        echo "  Failed to download $model"
        exit 1
    fi
}

echo "Checking Coqui TTS models..."
for model in "${MODELS[@]}"; do
    download_model "$model"
done
echo "Done."
