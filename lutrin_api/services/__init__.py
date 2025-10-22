# lutrin_api/services/__init__.py
# Rend les fonctions des modules directement accessibles via 'from services import ...'

from .camera_service import generate_frames, capture_image_from_webcam
from .ocr_service import ocr_image
from .tts_service import generate_tts_simulation
