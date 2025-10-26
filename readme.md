# Lutrin

Projet d'interface web pour contrôler une caméra sur un Raspberry Pi, effectuer une reconnaissance optique de caractères (OCR) sur les images capturées et générer une synthèse vocale (TTS) du texte reconnu.

## Installation

```
sudo apt install -y python3 python3-pip git make tesseract-ocr tesseract-ocr-fra
git clone https://github.com/afornerot/lutrin.git
cd lutrin
make install
```

## Utilisation

Le projet est géré via des commandes `make` simples et intuitives.

| Commande        | Description                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `make install`  | Installe / Met à jour les dépendances système, crée l'environnement virtuel et installe les paquets Python.                   |
| `make add-user` | Ajoute un nouvel utilisateur. **Usage :** `make add-user user=mon_user pass=mon_mot_de_passe email=mon_email role=USER,ADMIN` |
| `make start`    | Démarre les serveurs de l'API et du client en arrière-plan.                                                                   |
| `make stop`     | Arrête proprement les deux serveurs.                                                                                          |
| `make restart`  | Redémarre les serveurs (équivaut à `make stop && make start`).                                                                |
| `make watch`    | Redémarre le server API lors d'une modification d'un source python et log le server API                                       |
| `make status`   | Affiche le statut actuel des serveurs (en cours d'exécution ou arrêtés).                                                      |
| `make update`   | Met à jour le projet : arrête les serveurs, récupère les dernières modifications depuis Git, puis redémarre les serveurs.     |
| `make clean`    | Nettoie le projet en supprimant l'environnement virtuel Python.                                                               |
| `make`          | Affiche un message d'aide listant toutes les commandes disponibles.                                                           |

Une fois les serveurs démarrés avec `make start`, vous pouvez accéder à l'interface web à l'adresse : **http://localhost:8000**
Après avoir créé un utilisateur avec `make add-user`, la clé d'API générée s'affichera dans le terminal. Copiez cette clé et collez-la dans le champ "Clé d'API" de l'interface web pour pouvoir utiliser l'application.
 
## Configuration (`lutrin_api/.env`)

Le projet utilise des fichiers d'environnement pour gérer sa configuration, ce qui permet de séparer les paramètres de l'application du code source.

-   **`.env`**: Ce fichier contient la configuration par défaut. Il est inclus dans le contrôle de version (Git) et sert de modèle.
-   **`.env.local`**: Ce fichier (que vous devez créer manuellement si besoin) est utilisé pour surcharger les paramètres du `.env` pour votre environnement local. Il n'est **pas** inclus dans le contrôle de version et est idéal pour stocker des informations sensibles comme les clés d'API.

### Paramètres disponibles

-   `TTS_MODEL`: Chemin relatif vers le modèle de synthèse vocale Piper (`.onnx`).
-   `FLASK_PORT`: Le port sur lequel le serveur API Flask écoute.
-   `GROQ_TOKEN`: Votre clé d'API pour Groq OCR.
-   `COQUI_TTS_URL`: Url du service Coqui TTS.

### Obtenir une clé API Groq

Pour utiliser le mode OCR avec l'IA de Groq, vous devez fournir une clé API.

1.  Créez un compte sur le site de Groq.
2.  Accédez à la section des clés API de votre console : https://console.groq.com/keys
3.  Créez une nouvelle clé et copiez-la dans la variable `GROQ_TOKEN` de votre fichier `.env.local`.

## Structure des modules

Le projet est organisé en plusieurs composants clés :

### `Makefile`
Le point d'entrée principal pour le développeur. Il orchestre les tâches en déléguant la logique complexe au script `run.sh`.

### `run.sh`
Le cœur de l'automatisation. Ce script Bash gère la logique de démarrage, d'arrêt, de mise à jour et d'installation des services. Il est conçu pour être robuste et fournir des retours clairs à l'utilisateur.

### `lutrin_api/`
Le backend du projet. C'est une application **Flask** qui expose une API REST pour contrôler le matériel.
- **`server.py`**: Le routeur principal de l'API. Il définit les points d'accès (endpoints) comme `/status`, `/video`, `/capture`, `/ocr`, `/tts` et `/file`.
- **`services`**: Contient la logique métier. C'est ici que se trouvent les fonctions pour lancer récupérer l'image, la traiter en OCR, et simuler la synthèse vocale en TTS.
- **`config.py`**: Fichier de configuration pour les chemins, les ports, etc.
- **`requirements.txt`**: Liste les dépendances Python pour le backend (Flask, Waitress, Pillow, etc.).

### `lutrin_client/`
Le frontend du projet. C'est une application web statique (HTML, CSS, JavaScript) qui communique avec le backend.
- **`index.html`**: La page web unique qui constitue l'interface utilisateur.
- **`style.css`**: La feuille de style pour l'apparence de l'interface.
- **`lutrin.js`**: Le code js du client.

### `lutrin_tools/`
Un répertoire pour les scripts utilitaires partagés.
- **`ihm.sh`**: Un script shell fournissant des fonctions pour afficher des messages colorés et formatés dans le terminal, améliorant l'expérience utilisateur des scripts `run.sh`.
- **`voice-choice`**: échantillon des voix possibles pour la synthèse vocale Coqui