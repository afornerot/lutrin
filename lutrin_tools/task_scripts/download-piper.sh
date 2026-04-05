#!/bin/bash
set -e

MODELS_DIR="$(pwd)/lutrin_api/models"
mkdir -p "$MODELS_DIR"

# Liste des modèles Piper français à télécharger (format: nom_fichier url_huggingface)
# Siwis : voix féminine | UPMC : voix masculine | Tom : voix masculine naturelle | MLS : multi-speaker
MODELS=(
    "fr_FR-siwis-medium.onnx|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx"
    "fr_FR-siwis-medium.onnx.json|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json"
    "fr_FR-upmc-medium.onnx|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx"
    "fr_FR-upmc-medium.onnx.json|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx.json"
    "fr_FR-tom-medium.onnx|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx"
    "fr_FR-tom-medium.onnx.json|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx.json"
    "fr_FR-mls-medium.onnx|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/mls/medium/fr_FR-mls-medium.onnx"
    "fr_FR-mls-medium.onnx.json|https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/mls/medium/fr_FR-mls-medium.onnx.json"
)

echo "Checking Piper TTS models..."
for entry in "${MODELS[@]}"; do
    IFS='|' read -r filename url <<< "$entry"
    filepath="$MODELS_DIR/$filename"

    if [ -f "$filepath" ]; then
        echo "  Model already present: $filename"
    else
        echo "  Downloading $filename ..."
        curl -#L -o "$filepath" "$url"
        if [ $? -eq 0 ]; then
            echo "  Downloaded successfully."
        else
            echo "  Failed to download $filename"
            exit 1
        fi
    fi
done
echo "Done."
