# Lutrin

Projet d'interface web pour contrôler une caméra sur un Raspberry Pi, effectuer une reconnaissance optique de caractères (OCR) sur les images capturées et générer une synthèse vocale (TTS) du texte reconnu.

## Prérequis

- **Docker** et **Docker Compose** (installés via `make install`)
- **Task** (installé via `make install`)
- **Git**
- **Certificats SSL** (auto-signés) pour le client HTTPS
- **Clé API Groq** (optionnelle, pour l'OCR par IA)
- **Application Android** (optionnelle, pour le streaming depuis un téléphone)

## Installation

1.  Clonez le dépôt et entrez dans le répertoire :
    ```bash
    git clone https://github.com/afornerot/lutrin.git
    cd lutrin
    ```

2.  Installez les prérequis (Docker, Docker Compose, Task) :
    ```bash
    make install
    ```
    **Notes :**
    -   Après l'installation de Docker, déconnectez-vous et reconnectez-vous pour que les changements de groupe prennent effet.
    -   Vérifiez que `~/.local/bin` est dans votre `PATH` avec `make check-path`.
    -   Si ce n'est pas le cas, ajoutez-le : `echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc && source ~/.bashrc`.

3.  Générez les certificats SSL (si ce n'est pas déjà fait) et placez-les dans `lutrin_tools/certs/` :
    ```bash
    # Exemple de génération de certificat auto-signé
    openssl req -x509 -newkey rsa:4096 -keyout lutrin_tools/certs/key.pem -out lutrin_tools/certs/cert.pem -days 365 -nodes -subj "/C=FR/ST=France/L=Paris/O=Lutrin/OU=Dev/CN=localhost"
    ```

## Démarrage rapide

Après l'installation, suivez ces étapes :

1.  **Construisez les images et initialisez la base de données** (cela créera un utilisateur admin si aucun n'existe) :
    ```bash
    task build
    ```

2.  **Démarrez tous les services** :
    ```bash
    task start
    ```

3.  **Accédez à l'interface web** :
    -   Client (HTTPS) : **https://localhost:8000**
    -   API (HTTP) : **http://localhost:5000**

4.  **Configurez l'utilisateur** :
    -   Lors du premier `task build`, un utilisateur admin est créé interactivement.
    -   Une clé d'API est générée. Copiez-la et collez-la dans le champ "Clé d'API" de l'interface web.

## Gestion des utilisateurs

-   **Ajouter un utilisateur** :
    ```bash
    task add-user user=mon_user password=mon_mot_de_passe email=mon_email role=USER
    ```
    Rôles disponibles : `USER`, `ADMIN`.

-   **Changer un mot de passe** :
    ```bash
    task change-password user=mon_user password=nouveau_mot_de_passe
    ```

## Configuration (`lutrin_api/.env`)

Le projet utilise deux fichiers d'environnement :

-   **`.env`** : Configuration par défaut (inclus dans Git).
-   **`.env.local`** : Surcharge locale (non versionnée). Créez-le si besoin.

### Paramètres principaux

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `GROQ_TOKEN` | Clé API pour Groq OCR (optionnel) | `changeme` |
| `FRONT_URL` | URL du frontend pour les liens | `https://localhost:8000` |
| `COQUI_MODEL` | Modèle Coqui TTS | `tts_models/multilingual/multi-dataset/xtts_v2` |
| `FLASK_PORT` | Port de l'API Flask | `5000` |
| `CLIENT_PORT` | Port du client | `8000` |

### Obtenir une clé API Groq (optionnel)

Pour utiliser l'OCR par IA :
1.  Créez un compte sur [Groq](https://console.groq.com/).
2.  Accédez à la section des clés API.
3.  Créez une clé et ajoutez-la à `GROQ_TOKEN` dans votre `.env.local`.

## Commandes Task disponibles

| Commande | Description |
|----------|-------------|
| `task` | Liste toutes les tâches disponibles |
| `task build` | Construit les images, télécharge les modèles, initialise la base de données |
| `task start` | Démarre tous les services en arrière-plan |
| `task stop` | Arrête tous les services |
| `task restart` | Redémarre les services |
| `task status` | Affiche le statut des services |
| `task logs [service=api]` | Affiche les logs (spécifique à un service si `service=nom`) |
| `task clean` | Supprime conteneurs et images construites (conserve les données) |
| `task pull` | Met à jour depuis Git, reconstruit et redémarre |
| `task add-user` | Ajoute un utilisateur |
| `task change-password` | Change un mot de passe |
| `task watch` | Non implémenté (version Docker) |

## Architecture du projet

Le projet est composé de trois services Docker :

1.  **`api`** (port 5000) : Backend Flask (OCR, TTS, gestion des utilisateurs).
2.  **`client`** (port 8000) : Frontend (SPA + proxy HTTPS vers l'API).
3.  **`coqui`** (port 5002) : Service de synthèse vocale Coqui.

### Structure des répertoires

```
lutrin/
├── lutrin_api/          # Backend API Flask
├── lutrin_client/       # Frontend (HTML/CSS/JS)
├── lutrin_coqui/        # Script de démarrage Coqui
├── lutrin_data/         # Données persistantes (base de données, modèles)
│   ├── api/
│   └── coqui/
├── lutrin_tools/        # Utilitaires et scripts
│   ├── task_scripts/    # Scripts pour les commandes task
│   └── certs/           # Certificats SSL (gitignorés)
├── lutrin_apk/          # Application Android (APK dans dist/)
├── docker-compose.yml   # Orchestration des services
├── Taskfile.yml         # Définition des commandes task
└── Makefile             # Installation des prérequis
```

## Application Android

Une application Android est disponible pour télécharger le flux vidéo de la caméra du téléphone et l'envoyer au serveur.

- **Chemin** : `lutrin_apk/dist/lutrin.apk`
- **Fonctionnalités** :
    - Capture vidéo depuis la caméra du téléphone
    - Streaming vers le serveur Lutrin
    - Interface simplifiée pour la gestion de la connexion

L'application est disponible dans le dépôt GitHub et peut être téléchargée directement depuis ce chemin.

## Problèmes courants

-   **Permissions Docker** : Après `make install`, déconnectez-vous/reconnectez-vous pour que les changements de groupe prennent effet.
-   **Certificats SSL** : Assurez-vous que `lutrin_tools/certs/cert.pem` et `key.pem` existent.
-   **PATH** : Vérifiez que `~/.local/bin` est dans votre `PATH` (utilisez `make check-path`).
-   **Installation Task** : Si l'installation de Task échoue, vérifiez votre connexion Internet et réessayez. Le script peut nécessiter `curl` ou `wget`.
-   **Mise à jour** : Utilisez `task pull` pour mettre à jour le projet.

## Développement

-   Le code est monté dans les conteneurs pour le développement.
-   Modifiez le code dans `lutrin_api/` ou `lutrin_client/`, puis utilisez `task pull` pour reconstruire.
-   Le mode "watch" n'est pas implémenté pour la version Docker.