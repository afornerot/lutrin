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

httpd.socket = ssl.wrap_socket(httpd.socket, server_side=True, certfile=certfile, keyfile=keyfile, ssl_version=ssl.PROTOCOL_TLS)

print(f"Serving HTTPS on port {port}...")
httpd.serve_forever()