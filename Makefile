SHELL := /bin/bash

# Makefile pour le projet Lutrin
# ==============================
# Ce fichier automatise l'installation, le lancement, l'arrêt et la mise à jour du projet.

# --- Variables de configuration ---
API_DIR = lutrin_api
CLIENT_DIR = lutrin_client
VENV_DIR = $(API_DIR)/venv

# Interpréteurs Python et Pip du virtualenv
PYTHON = $(VENV_DIR)/bin/python3
PIP = $(VENV_DIR)/bin/pip3

# Port pour le serveur client (simple serveur HTTP Python)
CLIENT_PORT = 8000

# --- Couleurs pour un affichage plus agréable ---
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
BLUE   := $(shell tput -Txterm setaf 4)
RESET  := $(shell tput -Txterm sgr0)

# --- Cibles Makefile ---

.DEFAULT_GOAL := help

.PHONY: all install update start stop restart clean help logs

help:
	@echo "$(GREEN)Aide pour le Makefile du projet Lutrin$(RESET)"
	@echo "-------------------------------------------"
	@echo "Utilisez 'make <cible>' pour exécuter une commande."
	@echo ""
	@echo "Cibles disponibles:"
	@echo "  $(YELLOW)install$(RESET)   	- Installe les dépendances système et configure l'environnement Python."
	@echo "  $(YELLOW)start$(RESET)     	- Démarre les serveurs API et client en arrière-plan."
	@echo "  $(YELLOW)add-user$(RESET)  	- Ajoute un nouvel utilisateur. Usage: make add-user user=myuser pass=mypass email=me@domain.com [role=USER]"
	@echo "  $(YELLOW)stop$(RESET)      	- Arrête tous les serveurs."
	@echo "  $(YELLOW)watch$(RESET)      	- Watch les modifications sur API server et le relance si besoin."
	@echo "  $(YELLOW)status$(RESET)    	- Affiche le statut des serveurs."
	@echo "  $(YELLOW)restart$(RESET)   	- Redémarre les serveurs."
	@echo "  $(YELLOW)update$(RESET)    	- Met à jour le code depuis Git et redémarre les serveurs."
	@echo "  $(YELLOW)apilogs$(RESET)   	- Affiche les logs du serveur API en temps réel."
	@echo "  $(YELLOW)clientlogs$(RESET)	- Affiche les logs du serveur Client en temps réel."
	@echo "  $(YELLOW)clean$(RESET)     	- Supprime l'environnement virtuel Python."

install:
	chmod +x run.sh && ./run.sh install

add-user:
	./run.sh add-user $(user) $(pass) $(email) $(role)

update:
	./run.sh update

start:
	./run.sh start

stop:
	./run.sh stop

watch:
	./run.sh watch

status:
	./run.sh status

restart: stop start

apilogs:
	./run.sh apilogs

clientlogs:
	./run.sh clientlogs

clean:
	./run.sh clean
