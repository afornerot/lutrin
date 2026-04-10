SHELL := /bin/bash

# Makefile to install prerequisites for Lutrin project
# Installs Docker, Docker Compose, and Task

.PHONY: all install-docker install-compose install-task install check

all: install

check:
	@echo "Checking prerequisites..."
	@command -v docker >/dev/null 2>&1 && echo "Docker: installed" || echo "Docker: not installed"
	@docker compose version >/dev/null 2>&1 && echo "Docker Compose: installed" || echo "Docker Compose: not installed"
	@command -v task >/dev/null 2>&1 && echo "Task: installed" || echo "Task: not installed"

install: install-docker install-compose install-task
	@echo ""
	@echo "============================================"
	@echo "  IMPORTANT: Activate Docker group now!"
	@echo ""
	@echo "  Run this command in your terminal:"
	@echo "    newgrp docker"
	@echo ""
	@echo "  Then you can run 'task build' immediately."
	@echo "============================================"
	@echo ""
	@echo "All prerequisites installed."

install-docker:
	@echo "Installing Docker..."
	@curl -fsSL https://get.docker.com -o get-docker.sh
	@sudo sh get-docker.sh
	@sudo usermod -aG docker $$USER
	@rm get-docker.sh
	@echo "Docker installed."

install-compose:
	@echo "Installing Docker Compose plugin..."
	@sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
	@sudo chmod +x /usr/local/bin/docker-compose
	@echo "Docker Compose installed."

install-task:
	@echo "Installing Task..."
	@mkdir -p ~/.local/bin
	@sh -c "$$(curl -sSL https://taskfile.dev/install.sh)" -- -b ~/.local/bin
	@echo "Task installed to ~/.local/bin/task"
	@echo "Ensure ~/.local/bin is in your PATH."

check-path:
	@echo "Checking PATH..."
	@echo $$PATH | grep -q "$$HOME/.local/bin" || echo "WARNING: ~/.local/bin is not in your PATH."
	@echo "To add it, run: echo 'export PATH=\$$HOME/.local/bin:\$$PATH' >> ~/.bashrc && source ~/.bashrc"