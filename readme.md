# 📖 Lutrin

📖 **Lutrin** est un projet solidaire né lors du marathon d'innovation **[Hacking Health Besançon 2025](https://hacking-health.org/fr/besancon-fr/)**. 

🏆 **Lauréat du Hacking Health**, le projet est désormais accompagné et suivi par **[Le Tube à Essais](https://letubeaessais.fr/)**, une SCIC dédiée à l'incubation de projets innovants et solidaires.

### Le concept
L'objectif est simple : **rendre la lecture accessible à tous**, en particulier aux personnes souffrant de handicaps moteurs ou visuels qui ne peuvent pas manipuler de livres papier.

### Ce que fait Lutrin
Lutrin est une plateforme universelle qui transforme le texte en **livre audio personnalisé** en temps réel :
- **Capture de livres physiques** : Une simple webcam filme les pages d'un livre papier. L'IA reconnaît le texte et le lit instantanément avec une voix naturelle.
- **Bibliothèque Numérique (ePub)** : L'utilisateur peut importer ses propres fichiers ePub ou piocher dans une bibliothèque proposée par le serveur. 
- **Gestion Personnalisée** : Chaque utilisateur dispose de son propre espace pour gérer sa collection de livres numériques et reprendre sa lecture audio là où il s'est arrêté.
- **Interface Inclusive** : Un contrôle ultra-épuré (gros boutons, navigation simplifiée) conçu pour pallier les déficiences visuelles ou le manque de précision motrice.

## 📄 Liens utiles
- **Présentation du projet** : [Lien Canva](https://canva.link/q5t74ovnzwt6t10)
- **Support technique** : Utilisez les `issues` du dépôt GitHub.

## 🚀 Utilisation (Mode Utilisateur)

Si vous souhaitez utiliser le service sans installer de serveur, voici les accès directs :

### 🌐 Interface Web
Accédez à l'application de lecture directement via votre navigateur :
👉 **[https://lutrin.terium.org](https://lutrin.terium.org)**

### 📱 Application Android
Une application est disponible pour utiliser la caméra de votre téléphone comme scanner et l'envoyer au serveur.
- **Télécharger l'APK** : [`lutrin_apk/dist/lutrin.apk`](https://github.com/afornerot/lutrin/raw/main/lutrin_apk/dist/lutrin.apk)
- **Fonctionnalités** : Capture vidéo, streaming vers le serveur et interface de connexion simplifiée.


## 🛠️ Installation du Serveur (Mode Administrateur)

Cette section est destinée à l'hébergement de votre propre instance Lutrin.

### 📋 Prérequis
- **Docker** et **Docker Compose**
- **Task** (installé via `make install`)
- **Git**
- **Certificats SSL** (auto-signés ou officiels)

### ⚙️ Installation

1.  **Cloner le dépôt** :
    ```bash
    git clone [https://github.com/afornerot/lutrin.git](https://github.com/afornerot/lutrin.git)
    cd lutrin
    ```

2.  **Installer les outils (Docker, Task)** :
    ```bash
    make install
    ```
    *Note : Après l'installation, déconnectez-vous et reconnectez-vous pour que les changements de groupe Docker prennent effet.*

3.  **Générer les certificats SSL** (requis pour le client HTTPS) :
    Placez-les dans `lutrin_tools/certs/` :
    ```bash
    openssl req -x509 -newkey rsa:4096 -keyout lutrin_tools/certs/key.pem -out lutrin_tools/certs/cert.pem -days 365 -nodes -subj "/C=FR/ST=France/L=Paris/O=Lutrin/CN=localhost"
    ```

4.  **Démarrage** :
    ```bash
    task build   # Construit les images et initialise la base de données
    task start   # Démarre tous les services en arrière-plan
    ```

### 🌍 Accès aux services locaux
- **Client (HTTPS)** : `https://localhost:8000`
- **API (HTTP)** : `http://localhost:5000`

---

## 🔧 Configuration et Administration

### Gestion des utilisateurs
Lors du premier `task build`, un administrateur est créé. Vous pouvez en ajouter d'autres via le terminal :
- **Ajouter un utilisateur** : `task add-user user=nom password=pass email=mail@mail.com role=USER`
- **Changer un mot de passe** : `task change-password user=nom password=nouveau_pass`

### Variables d'environnement (`lutrin_api/.env`)
| Variable | Description |
|----------|-------------|
| `GROQ_TOKEN` | Clé API pour Groq OCR (optionnel, pour une vitesse accrue) |
| `COQUI_MODEL` | Modèle de synthèse vocale utilisé |
| `CLIENT_PORT` | Port d'écoute du frontend (8000 par défaut) |

---

## 🏗️ Architecture Technique

Le projet est composé de trois services Docker :
1.  **`api`** : Backend Flask (OCR, gestion utilisateur, logique).
2.  **`client`** : Frontend web et proxy HTTPS.
3.  **`coqui`** : Moteur de synthèse vocale (TTS).

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

