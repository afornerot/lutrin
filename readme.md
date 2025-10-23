
## Installation des dépendances

Installation de l'outil Tesseract et des données de langue française
```
git clone https://github.com/afornerot/lutrin.git
sudo apt install -y python3 python3-pip git make tesseract-ocr tesseract-ocr-fra

```


## Création du projet

mkdir -p ~/lutrin_api
mkdir -p ~/lutrin_data
cd ~/lutrin_api
python3 -m venv venv
source venv/bin/activate
echo -e "Flask\nPillow\npytesseract\nopencv-python-headless\nwaitress\nflask-cors" > ~/lutrin_api/requirements.txt
pip3 install -r requirements.txt
python server.py

## Lancer le projet
source venv/bin/activate
python server.py