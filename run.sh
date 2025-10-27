#!/bin/bash

# Importation des fonctions d'affichage
source "$(dirname "$0")/lutrin_tools/ihm.sh"

# Script pour gérer le démarrage, l'arrêt et le statut des serveurs Lutrin (API et Client)

# --- Configuration ---
API_DIR="lutrin_api"
CLIENT_DIR="lutrin_client"
VENV_PYTHON="$API_DIR/venv/bin/python3"
VENV_PIP="$API_DIR/venv/bin/pip3"
API_PORT=5000
CLIENT_PORT=8000

# Fichiers pour stocker les PIDs (Process IDs) des serveurs
API_PID_FILE="/tmp/lutrin_api.pid"
CLIENT_PID_FILE="/tmp/lutrin_client.pid"
CLIENT_CONFIG_FILE="$CLIENT_DIR/js/config.js"

# Configuration SSL pour le serveur client
CERT_DIR="lutrin_tools/certs"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

# Fichiers de log pour les serveurs
API_LOG_FILE="/tmp/lutrin_api.log"
CLIENT_LOG_FILE="/tmp/lutrin_client.log"

# --- Fonctions de gestion des services ---

generate_client_config() {
    Title "Génération de la configuration client"
    # 1. Détecter l'IP locale comme suggestion
    local detected_ip=$(hostname -I | awk '{print $1}')

    # Si hostname -I échoue ou retourne une chaîne vide, on se rabat sur localhost
    if [ -z "$detected_ip" ]; then
        detected_ip="localhost"
    fi

    # 2. Demander à l'utilisateur de confirmer ou de modifier l'IP et le port
    read -p "Entrez l'adresse IP ou le nom d'hôte pour l'API [défaut: $detected_ip]: " user_ip
    local final_ip=${user_ip:-$detected_ip}

    read -p "Entrez le port pour l'API [défaut: $API_PORT]: " user_port
    local final_port=${user_port:-$API_PORT}

    EchoBleu "Configuration de l'application sur : https://$final_ip:$CLIENT_PORT"

    # 3. Écrire la configuration finale dans le fichier config.js
    cat > "$CLIENT_CONFIG_FILE" << EOL
export const API_BASE_URL = 'https://${final_ip}:${CLIENT_PORT}/api';
EOL
    EchoVert "Fichier de configuration client '$CLIENT_CONFIG_FILE' généré."

    # 4. Générer le certificat SSL en utilisant l'IP/hostname fourni
    Title "Vérification/Génération du certificat SSL"
    if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
        EchoVert "Certificat SSL existant trouvé. Aucune génération nécessaire."
    else
        EchoOrange "Génération d'un certificat SSL auto-signé pour '$final_ip'..."
        mkdir -p "$CERT_DIR"
        openssl req -x509 -newkey rsa:2048 -keyout "$KEY_FILE" -out "$CERT_FILE" -days 365 -nodes \
            -subj "/C=FR/ST=France/L=Paris/O=Lutrin/OU=Dev/CN=$final_ip"
        EchoVert "Certificat généré avec succès."
        EchoOrange "Note: Vous devrez accepter une exception de sécurité dans votre navigateur lors de la première connexion."
    fi
}

start_api() {
    Title "Démarrage du serveur API Lutrin"
    if [ -f "$API_PID_FILE" ]; then
        EchoOrange "Le serveur API semble déjà en cours d'exécution."
    else
        # Utilise le python du virtualenv directement pour plus de robustesse
        # L'option -u est cruciale pour désactiver la mise en tampon de la sortie et voir les logs en temps réel.
        nohup $VENV_PYTHON -u -m lutrin_api.server > "$API_LOG_FILE" 2>&1 & echo $! > "$API_PID_FILE"
        local api_ip=$(grep -oP 'const IP_ADDRESS = "\K[^"]+' "$CLIENT_CONFIG_FILE" || echo "localhost")
        EchoVert "Serveur API démarré avec le PID $(cat $API_PID_FILE) sur http://127.0.0.1:$API_PORT. Logs dans $API_LOG_FILE"
    fi
    EchoBlanc
}

start_client() {
    Title "Démarrage du serveur client Lutrin"
    if [ -f "$CLIENT_PID_FILE" ]; then
        EchoOrange "Le serveur client semble déjà en cours d'exécution."
    else
        cd "$CLIENT_DIR" # On est déjà dans le répertoire lutrin_client
        nohup python3 -u server.py "$CLIENT_PORT" "$API_PORT" "../$CERT_FILE" "../$KEY_FILE" > "$CLIENT_LOG_FILE" 2>&1 & echo $! > "$CLIENT_PID_FILE"
        cd ..
        # Lire l'IP depuis le fichier de config pour un message correct
        local client_ip=$(grep -oP 'const IP_ADDRESS = "\K[^"]+' "$CLIENT_CONFIG_FILE" || echo "localhost")
        local client_port=$(grep -oP 'const CLIENT_PORT = \K[0-9]+' "$CLIENT_CONFIG_FILE" || echo "$CLIENT_PORT")
        EchoVert "Serveur client démarré avec le PID $(cat $CLIENT_PID_FILE) sur https://$client_ip:$client_port. Logs dans $CLIENT_LOG_FILE"
    fi
    EchoBlanc
}

stop_api() {
    Title "Arrêt du serveur API Lutrin"
    if [ -f "$API_PID_FILE" ]; then
        kill "$(cat $API_PID_FILE)" 2>/dev/null || true # Supprime les erreurs si le PID n'existe plus
        rm -f "$API_PID_FILE"
        EchoVert "Serveur API arrêté."
    else
        EchoOrange "Le serveur API n'était pas en cours d'exécution."
    fi
    EchoBlanc
}

stop_client() {
    Title "Arrêt du serveur client"
    if [ -f "$CLIENT_PID_FILE" ]; then
        kill "$(cat $CLIENT_PID_FILE)" 2>/dev/null || true
        rm -f "$CLIENT_PID_FILE"
        EchoVert "Serveur client arrêté."
    else
        EchoOrange "Le serveur client n'était pas en cours d'exécution."
    fi
    EchoBlanc
}

status_service() {
    local service_name="$1"
    local pid_file="$2"
    local port_info="$3" # Peut être vide

    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if ps -p $PID > /dev/null 2>&1; then
            EchoVert "✅ $service_name en cours d'exécution (PID: $PID)${port_info}"
        else
            EchoRouge "⚠️ Fichier PID $service_name trouvé mais le processus ne tourne plus, suppression du PID orphelin $PID."
            #rm -f "$pid_file"
        fi
    else
        EchoRouge "❌ $service_name non démarré."
    fi
    EchoBlanc
}

status_all() {
    local client_ip=$(grep -oP 'const IP_ADDRESS = "\K[^"]+' "$CLIENT_CONFIG_FILE" || echo "localhost")
    status_service "Serveur API" "$API_PID_FILE" " sur http://127.0.0.1:$API_PORT (via proxy)"
    status_service "Serveur client" "$CLIENT_PID_FILE" " sur https://$client_ip:$CLIENT_PORT"
}

install_project() {
    BigTitle "Installation du projet Lutrin"

    Title "Installation des dépendances système"
    EchoOrange "Cette étape nécessite les droits super-utilisateur (sudo)."
    sudo apt update && sudo apt install -y python3 python3-pip python3-venv git make inotify-tools libgl1 openssl
    if [ $? -ne 0 ]; then
        EchoRouge "L'installation des dépendances système a échoué."
        exit 1
    fi
    EchoBlanc
    EchoVert "Dépendances système installées."
    EchoBlanc

    Title "Mise à jour du code source depuis Git"
    git pull
    EchoVert "Code source mis à jour."
    EchoBlanc
    
    Title "Installation de Docker et Docker Compose (méthode officielle)"
    # Vérifier si Docker est déjà installé
    if ! command -v docker &> /dev/null; then
        EchoOrange "Docker n'est pas détecté. Lancement de l'installation..."
        # Ajout du dépôt officiel de Docker
        sudo apt-get install -y ca-certificates curl
        sudo install -m 0755 -d /etc/apt/keyrings
        sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        sudo chmod a+r /etc/apt/keyrings/docker.asc

        # Ajout du dépôt à la liste des sources Apt
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update

        # Installation des paquets Docker
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        EchoVert "Docker et Docker Compose installés avec succès."
        EchoOrange "Pour utiliser Docker sans 'sudo', vous pouvez ajouter votre utilisateur au groupe 'docker' :"
        EchoBleu "sudo usermod -aG docker \$USER"
        EchoOrange "Vous devrez vous déconnecter et vous reconnecter pour que ce changement prenne effet."
    else
        EchoVert "Docker est déjà installé."
    fi

    Title "Création de l'environnement virtuel Python"
    if [ -d "$API_DIR/venv" ]; then
        EchoVert "L'environnement virtuel existe déjà."
    else
        python3 -m venv "$API_DIR/venv"
        EchoVert "Environnement virtuel créé dans '$API_DIR/venv'."
        # Sur certains systèmes, venv ne crée pas pip. On le force.
        EchoBleu "Vérification et installation de pip dans l'environnement virtuel..."
        curl -sS https://bootstrap.pypa.io/get-pip.py | "$VENV_PYTHON"
        if [ $? -ne 0 ]; then
            EchoRouge "L'installation de pip dans l'environnement virtuel a échoué."
            exit 1
        fi
    fi
    EchoBlanc
    
    Title "Installation/Vérification de Coqui TTS"
    cd lutrin_coqui

    Echo "Mise à jour de l'image de Coqui"
    sudo docker-compose pull
   
    local coqui_model_dir="./coqui-data/tts_models--multilingual--multi-dataset--xtts_v2"
    if [ -d "$coqui_model_dir" ]; then
        EchoVert "Le modèle Coqui TTS est déjà présent."
    else
        EchoOrange "Le modèle Coqui TTS n'a pas été trouvé. Téléchargement en cours..."
        EchoBleu "Cette opération peut prendre plusieurs minutes et nécessite environ 2 Go d'espace disque."
        sudo docker run --rm -it \
            -v ./coqui-data:/root/.local/share/tts/ \
            --entrypoint tts \
            ghcr.io/coqui-ai/tts-cpu \
            --model_name tts_models/multilingual/multi-dataset/xtts_v2 \
            --list_speaker_idx
        EchoVert "Modèle Coqui TTS téléchargé."
    fi
    Echo "Execution du service Coqui"
    sudo docker-compose up -d
    cd ..

    Title "Installation des dépendances Python"
    # S'assurer que pip est à jour dans le venv
    "$VENV_PYTHON" -m pip install --upgrade pip
    # Installer les requirements
    "$VENV_PIP" install -r "$API_DIR/requirements.txt"
    EchoVert "Dépendances Python installées avec succès."
    EchoBlanc

    Title "Initialisation de la base de données"
    "$VENV_PYTHON" -c "from lutrin_api.services import auth_service; auth_service.init_db()"
    EchoVert "Base de données prête."
    EchoBlanc

    Title "Vérification des utilisateurs"
    USER_COUNT=$("$VENV_PYTHON" -c "from lutrin_api.services import auth_service; print(auth_service.count_users())")

    if [ "$USER_COUNT" -eq 0 ]; then
        EchoOrange "Aucun utilisateur trouvé. Création du premier compte administrateur."
        
        # Demander les informations à l'utilisateur
        read -p "Entrez le nom d'utilisateur pour l'administrateur: " admin_user
        while [ -z "$admin_user" ]; do
            EchoRouge "Le nom d'utilisateur ne peut pas être vide."
            read -p "Entrez le nom d'utilisateur pour l'administrateur: " admin_user
        done

        read -sp "Entrez le mot de passe pour l'administrateur (sera masqué): " admin_pass
        echo
        while [ -z "$admin_pass" ]; do
            EchoRouge "Le mot de passe ne peut pas être vide."
            read -sp "Entrez le mot de passe pour l'administrateur (sera masqué): " admin_pass
            echo
        done

        read -p "Entrez l'email pour l'administrateur: " admin_email
        while [ -z "$admin_email" ]; do
            EchoRouge "L'email ne peut pas être vide."
            read -p "Entrez l'email pour l'administrateur: " admin_email
        done

        # Appeler la fonction add_user avec les informations saisies et le rôle ADMIN
        "$VENV_PYTHON" -c "from lutrin_api.services import auth_service; auth_service.add_user('$admin_user', '$admin_pass', '$admin_email', 'ADMIN')"
    else
        EchoVert "Des utilisateurs existent déjà dans la base de données."
    fi
    EchoBlanc
    
    # Générer la configuration client avec l'IP détectée
    generate_client_config
    EchoBlanc

    Title "Installation Terminée"
    EchoVert "✅ Installation terminée avec succès !"
    EchoBlanc "Lancez 'make start' pour démarrer les serveurs."
}

add_user_command() {
    BigTitle "Ajout d'un nouvel utilisateur"
    if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
        EchoRouge "Usage: $0 add-user <username> <password> <email> [role]"
        exit 1
    fi
    local username="$2"
    local password="$3"
    local email="$4"
    local role="${5:-USER}" # Le rôle est optionnel, 'USER' par défaut

    if [ ! -f "$VENV_PYTHON" ]; then
        EchoRouge "L'environnement virtuel n'est pas trouvé. Lancez d'abord 'make install'."
        exit 1
    fi

    EchoBleu "Ajout de l'utilisateur '$username'..."
    "$VENV_PYTHON" -c "
from lutrin_api.services import auth_service
auth_service.add_user('$username', '$password', '$email', '$role')
"
    EchoVert "Opération terminée."
    EchoBlanc
}

clean_project() {
    BigTitle "Nettoyage du projet Lutrin"
    EchoOrange "Cette action va supprimer l'environnement virtuel."
    rm -rf "$API_DIR/venv"
    rm -f "$CLIENT_CONFIG_FILE"
    EchoVert "Environnement virtuel supprimé."
    EchoVert "Fichier de configuration client supprimé."
    rm -f "$API_LOG_FILE"
    rm -f "$CLIENT_LOG_FILE"
    EchoVert "Fichiers de log supprimés."
    EchoBlanc
}

watch_api_changes() {
    BigTitle "Mode Watch pour Lutrin API"
    EchoVert "Surveillance des modifications de fichiers .py dans '$API_DIR'..."
    EchoVert "Le serveur API sera redémarré automatiquement en cas de changement."
    EchoBlanc

    # Vérifier si inotifywait est installé
    if ! command -v inotifywait &> /dev/null
    then
        EchoRouge "Erreur: 'inotifywait' n'est pas installé. Veuillez l'installer (par exemple: sudo apt install inotify-tools)."
        exit 1
    fi

    # Fonction de nettoyage pour tuer le processus tail en arrière-plan
    cleanup() {
        EchoOrange "\nArrêt du mode watch..."
        if [ -n "$TAIL_PID" ]; then
            kill "$TAIL_PID" 2>/dev/null
            EchoVert "Processus 'tail' arrêté."
        fi
        # On peut aussi arrêter le serveur API ici pour un nettoyage complet
        stop_api
        exit 0
    }

    # Intercepter le signal de sortie (Ctrl+C) pour appeler la fonction de nettoyage
    trap cleanup INT TERM

    # Démarrage initial (la config est déjà générée par 'make install')
    start_all_and_tail

    while true; do
        # Surveiller les événements de modification, création, suppression, déplacement de fichiers .py de manière récursive
        # Le -q rend inotifywait silencieux jusqu'à ce qu'un événement se produise
        inotifywait -q -r -e modify,create,delete,move "$API_DIR" --include '\.py$'
        
        EchoJaune "Modification détectée ! Redémarrage du serveur API..."
        kill "$TAIL_PID" 2>/dev/null # Arrêter l'ancien tail
        stop_api
        start_api
        EchoBleu "Temporisation de 5 secondes pour permettre l'initialisation du serveur..."
        sleep 5
        EchoVert "Reprise de la surveillance."
        EchoBlanc
        EchoBlanc
        start_tail
    done
}

start_all_and_tail() {
    stop_api
    stop_client
    start_api
    start_client
    start_tail
}

start_tail() {
    tail -f "$API_LOG_FILE" &
    TAIL_PID=$!
}

prompt_for_ip() {
    local current_ip=$(hostname -I | awk '{print $1}')
    read -p "Adresse IP détectée: $current_ip. Appuyez sur Entrée pour utiliser cette IP, ou entrez une nouvelle adresse: " new_ip
    if [ -z "$new_ip" ]; then
        ip_address="$current_ip"
    else
        ip_address="$new_ip"
    fi
}

# --- Point d'entrée ---
case "$1" in
    install)
        install_project
        ;;
    add-user)
        add_user_command "$@"
        ;;
    start)
        BigTitle "Démarrage des services Lutrin"
        start_api
        start_client
        ;;
    stop)
        BigTitle "Arrêt des services Lutrin"
        stop_api
        stop_client
        EchoBlanc
        ;;
    apilogs)
        BigTitle "Logs du serveur API"
        if [ -f "$API_LOG_FILE" ]; then
            tail -f $API_LOG_FILE
        fi
        ;;
    clientlogs)
        BigTitle "Logs du serveur Client"
        if [ -f "$CLIENT_LOG_FILE" ]; then
            tail -f $CLIENT_LOG_FILE
        fi
        ;;
    status)
        BigTitle "Statut des services Lutrin"
        status_all
        ;;
    clean)
        clean_project
        EchoBlanc
        ;;
    watch)
        watch_api_changes
        ;;
    *)
        EchoOrange "Usage: $0 {install|add-user|start|stop|watch|status|apilogs|clientlogs|clean}"
        EchoBlanc
        exit 1
        ;;
esac
