# Basé sur l'image du fork maintenu d'Idiap (coqui-tts 0.27.5)
# https://github.com/idiap/coqui-ai-TTS — PyTorch n'est plus bundlé depuis la 0.27.4
FROM ghcr.io/idiap/coqui-tts-cpu

RUN /opt/venv/bin/python3 -m ensurepip --upgrade \
    && /opt/venv/bin/python3 -m pip install --no-cache-dir torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu

# Le package TTS est installé en "editable" via un .pth pointant sur /app ;
# comme /app est remplacé par le volume start.sh au run, on copie les sources
# vers une localisation fixe.
RUN mkdir -p /opt/tts_pkg \
    && cp -r /app/TTS /opt/tts_pkg/ \
    && echo /opt/tts_pkg > /opt/venv/lib/python3.12/site-packages/_coqui_tts.pth
