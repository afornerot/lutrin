## Installation Py

- Installation de Py3 64bit sur carte SD 15Go via rpi-imager
- Avant de lancer le formatage bien configurer wifi / login / password
- Branchement de la Py3 avec la carte SD
- Update de la Py3
- Brancher un écran en HDMI / Souris USB / Clavier USB

## Activer le ssh sur la Py

```
sudo systemctl enable ssh
sudo systemctl start ssh
```

## Installation des dépendances

Installation de l'outil Tesseract et des données de langue française
```
sudo apt install -y tesseract-ocr tesseract-ocr-fra`
```

Installation des outils nécessaires pour Python si ce n'est pas déjà fait
```
sudo apt install -y python3 python3-pip git
```

## Création du projet

mkdir -p ~/lutrin_app
mkdir -p ~/lutrin_data
cd ~/lutrin_app
python3 -m venv venv
source venv/bin/activate
echo -e "Flask\nPillow\npytesseract\nopencv-python-headless\nwaitress\nflask-cors" > ~/lutrin_api/requirements.txt
pip3 install -r requirements.txt
python server.py

## Lancer le projet
source venv/bin/activate
python server.py