import http.server
import ssl
import sys

# Usage: python3 https_server.py <port> <certfile> <keyfile>
if len(sys.argv) != 4:
    print("Usage: python3 https_server.py <port> <certfile> <keyfile>")
    sys.exit(1)

port = int(sys.argv[1])
certfile = sys.argv[2]
keyfile = sys.argv[3]

server_address = ('0.0.0.0', port)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

# Créer un contexte SSL (méthode moderne)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile=certfile, keyfile=keyfile)

# Envelopper le socket du serveur avec le contexte SSL
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving HTTPS on port {port}...")
httpd.serve_forever()