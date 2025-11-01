import http.server
import ssl
import sys
import os
import requests
from urllib.parse import urlparse

class ReverseProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.api_base_url = kwargs.pop('api_base_url', 'http://localhost:5000')
        # Définir le répertoire de base pour les fichiers statiques
        # C'est le répertoire où se trouve ce script (lutrin_client)
        self.client_base_dir = os.path.join(os.path.dirname(__file__))
        super().__init__(*args, **kwargs)

    def translate_path(self, path):
        # Utilise le répertoire de base du client pour la recherche de fichiers
        return super().translate_path(path)

    def do_GET(self):
        if self.path.startswith('/api/') or self.path.startswith('/file/'):
            self.proxy_request()
        else:
            # Gérer le fallback pour les routes SPA
            requested_path = self.path.split('?')[0]
            file_path = os.path.join(self.client_base_dir, requested_path.lstrip('/'))
            if os.path.exists(file_path) and os.path.isfile(file_path):
                super().do_GET() # Servir le fichier statique s'il existe
            else:
                self.path = '/index.html' # Sinon, servir index.html
                super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            return self.proxy_request()
        else:
            self.send_error(404, "File not found")

    def proxy_request(self):
        # Supprimer le préfixe '/api' du chemin avant de le transférer
        if self.path.startswith('/api/'):
            target_path = self.path.replace('/api', '', 1)
        else:
            target_path = self.path
        target_url = f"{self.api_base_url}{target_path}"
        
        # Lire le corps de la requête originale
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Transférer les en-têtes
        headers = {key: value for key, value in self.headers.items()}

        try:
            # Envoyer la requête au serveur API
            resp = requests.request(self.command, target_url, headers=headers, data=body, stream=True, verify=False)

            # Transférer la réponse de l'API au client
            self.send_response(resp.status_code)
            for key, value in resp.headers.items():
                if key.lower() not in ('content-encoding', 'transfer-encoding', 'content-length'):
                    self.send_header(key, value)
            self.send_header('Content-Length', str(len(resp.content)))
            self.end_headers()
            self.wfile.write(resp.content)

        except requests.exceptions.RequestException as e:
            self.send_error(502, f"Proxy Error: {e}")

# --- Point d'entrée du script ---
if len(sys.argv) != 5:
    print("Usage: python3 https_server.py <client_port> <api_port> <certfile> <keyfile>")
    sys.exit(1)

client_port = int(sys.argv[1])
api_port = int(sys.argv[2])
certfile = sys.argv[3]
keyfile = sys.argv[4]

api_base_url = f"http://127.0.0.1:{api_port}"
handler = lambda *args, **kwargs: ReverseProxyHandler(*args, api_base_url=api_base_url, **kwargs)

server_address = ('0.0.0.0', client_port)
httpd = http.server.HTTPServer(server_address, handler)

context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
context.load_cert_chain(certfile=certfile, keyfile=keyfile)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving client on HTTPS port {client_port} and proxying /api/ to {api_base_url}...")
httpd.serve_forever()