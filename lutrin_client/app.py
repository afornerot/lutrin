import os
import requests
from flask import Flask, request, Response, send_from_directory

# --- Configuration et Initialisation ---

# Par défaut, le port API est 5000. Vous pouvez le lire depuis les variables d'environnement.
# C'est la façon la plus propre de passer les paramètres à Gunicorn/Flask.
API_PORT = os.environ.get("API_PORT", "5000")
API_HOST = os.environ.get("API_HOST", "127.0.0.1")
API_BASE_URL = f"http://{API_HOST}:{API_PORT}"

# Définir le répertoire de base pour les fichiers statiques (là où se trouve ce script)
CLIENT_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialisation de l'application Flask
# On désactive le static_folder par défaut de Flask car nous gérons le fallback nous-mêmes.
app = Flask(__name__, static_folder=None) 

def proxy_request():
    """Gère le transfert de la requête vers l'API backend."""
    
    # Déterminer le chemin cible : Supprimer le préfixe si nécessaire
    target_path = request.path
    if target_path.startswith('/api/'):
        # Supprimer le préfixe '/api' (une seule fois)
        target_path = target_path.replace('/api', '', 1) 
    
    target_url = f"{API_BASE_URL}{target_path}"
    
    # Transférer les en-têtes (Flask les rend faciles à utiliser)
    headers = dict(request.headers)
    
    # ⚠️ CORRECTION CRUCIALE POUR LE PROXY D'UPLOAD ET GUNICORN ⚠️
    # 1. Retirer les en-têtes qui ne doivent pas être transférés au backend
    headers.pop('Host', None)
    # Laissez requests recalculer le Content-Length basé sur les données brutes
    headers.pop('Content-Length', None) 
    
    # 2. Récupérer le corps brut de la requête entrante (nécessaire pour multipart)
    # Utilisez request.get_data() pour lire le corps brut de la requête sans décodage
    # Cela garantit que toutes les données (y compris le fichier binaire) sont transférées.
    data = request.get_data()
    
    try:
        # Envoyer la requête au serveur API (utilise request.method pour GET/POST/etc.)
        resp = requests.request(
            request.method,
            target_url,
            headers=headers,
            # Utiliser le corps brut récupéré
            data=data, 
            stream=True, 
            verify=False # IMPORTANT: Garde cette ligne pour ignorer la vérification SSL si le backend est auto-signé
        )

        # Transférer la réponse de l'API au client
        response = Response(resp.content, resp.status_code)
        
        # Copier les en-têtes de l'API à la réponse client
        for key, value in resp.headers.items():
            # Exclure les en-têtes de transfert que Nginx ou Flask vont gérer
            if key.lower() not in ('content-encoding', 'transfer-encoding', 'content-length', 'connection'):
                response.headers[key] = value
        
        # Mettre à jour la longueur du contenu pour Flask/Nginx
        response.headers['Content-Length'] = str(len(resp.content))

        return response

    except requests.exceptions.RequestException as e:
        # Gérer l'erreur de connexion à l'API (502 Gateway Timeout côté Nginx si trop lent)
        app.logger.error(f"Proxy Error connecting to API: {e}")
        return Response(f"Proxy Error: Cannot connect to backend API.", status=502)

# --- Routage Flask ---

# Route pour le proxy API
# Capture toutes les méthodes HTTP et tous les chemins sous /api/ ou /file/
@app.route('/api/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
@app.route('/file/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
@app.route('/file/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def handle_proxy(path):
    return proxy_request()


# Route pour les fichiers statiques et le Fallback SPA
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # 1. Tente de servir le fichier statique demandé (e.g., /css/style.css)
    # Le chemin est construit à partir du répertoire de base (CLIENT_BASE_DIR)
    file_path = os.path.join(CLIENT_BASE_DIR, path)
    
    if path == "":
        path = "index.html"

    # Vérifie si le fichier existe
    if os.path.exists(file_path) and os.path.isfile(file_path):
        # Utilise send_from_directory pour servir le fichier
        return send_from_directory(CLIENT_BASE_DIR, path)
    
    # 2. Fallback SPA : Si le fichier n'est pas trouvé (e.g., /ma/route/spa),
    # retourne index.html pour que le routeur JavaScript prenne le relais.
    return send_from_directory(CLIENT_BASE_DIR, 'index.html')


# --- Point d'entrée pour Gunicorn ---
if __name__ == '__main__':
    CLIENT_PORT = int(os.environ.get("CLIENT_PORT", "8000"))
    app.run(host='0.0.0.0', port=CLIENT_PORT, debug=True)