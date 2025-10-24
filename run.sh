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

# Fichiers de log pour les serveurs
API_LOG_FILE="/tmp/lutrin_api.log"
CLIENT_LOG_FILE="/tmp/lutrin_client.log"

# --- Fonctions de gestion des services ---

start_api() {
    Title "Démarrage du serveur API Lutrin"
    if [ -f "$API_PID_FILE" ]; then
        EchoOrange "Le serveur API semble déjà en cours d'exécution."
    else
        # Utilise le python du virtualenv directement pour plus de robustesse
        # L'option -u est cruciale pour désactiver la mise en tampon de la sortie et voir les logs en temps réel.
        nohup $VENV_PYTHON -u $API_DIR/server.py > "$API_LOG_FILE" 2>&1 & echo $! > "$API_PID_FILE"
        EchoVert "Serveur API démarré avec le PID $(cat $API_PID_FILE) sur http://localhost:$API_PORT. Logs dans $API_LOG_FILE"
    fi
    EchoBlanc
}

start_client() {
    Title "Démarrage du serveur client Lutrin"
    if [ -f "$CLIENT_PID_FILE" ]; then
        EchoOrange "Le serveur client semble déjà en cours d'exécution."
    else
        cd "$CLIENT_DIR"
        nohup python3 -u -m http.server "$CLIENT_PORT" > "$CLIENT_LOG_FILE" 2>&1 & echo $! > "$CLIENT_PID_FILE"
        cd ..
        EchoVert "Serveur client démarré avec le PID $(cat $CLIENT_PID_FILE) sur http://localhost:$CLIENT_PORT. Logs dans $CLIENT_LOG_FILE"
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
    rm -rf $API_LOG_FILE
    rm -rf $CLIENT_LOG_FILE
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
    status_service "Serveur API" "$API_PID_FILE" " sur http://localhost:$API_PORT"
    status_service "Serveur client" "$CLIENT_PID_FILE" " sur http://localhost:$CLIENT_PORT"
}

install_project() {
    BigTitle "Installation du projet Lutrin"

    Title "Installation des dépendances système"
    EchoOrange "Cette étape nécessite les droits super-utilisateur (sudo)."
    sudo apt update && sudo apt install -y python3 python3-pip git make tesseract-ocr tesseract-ocr-fra inotify-tools
    if [ $? -ne 0 ]; then
        EchoRouge "L'installation des dépendances système a échoué."
        exit 1
    fi
    EchoVert "Dépendances système installées."
    EchoBlanc

    Title "Configuration des permissions"
    EchoVert "Script 'run.sh' rendu exécutable."
    EchoBlanc

    Title "Création de l'environnement virtuel Python"
    if [ -d "$API_DIR/venv" ]; then
        EchoOrange "L'environnement virtuel existe déjà."
    else
        python3 -m venv "$API_DIR/venv"
        EchoVert "Environnement virtuel créé dans '$API_DIR/venv'."
    fi
    EchoBlanc

    Title "Mise à jour du code source depuis Git"
    git pull
    EchoBlanc

    Title "Installation des dépendances Python"
    "$VENV_PIP" install -r "$API_DIR/requirements.txt"
    EchoVert "Dépendances Python installées avec succès."
    EchoBlanc

    EchoVert "✅ Installation terminée avec succès !"
    EchoBlanc "Lancez 'make start' pour démarrer les serveurs."
}

clean_project() {
    BigTitle "Nettoyage du projet Lutrin"
    EchoOrange "Cette action va supprimer l'environnement virtuel."
    rm -rf "$API_DIR/venv"
    EchoVert "Environnement virtuel supprimé."
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

    # Démarrage initial
    stop_api
    stop_client
    start_api
    start_client

    # Lancer tail -f en arrière-plan et stocker son PID
    tail -f "$API_LOG_FILE" &
    TAIL_PID=$!

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
        tail -f "$API_LOG_FILE" & # Lancer un nouveau tail
        TAIL_PID=$!
    done
}

# --- Point d'entrée ---
case "$1" in
    install)
        install_project
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
        EchoOrange "Usage: $0 {install|start|stop|watch|status|apilogs|clientlogs|clean"
        EchoBlanc
        exit 1
        ;;
esac
