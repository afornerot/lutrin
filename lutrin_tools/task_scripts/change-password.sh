#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <username> <new_password>"
    exit 1
fi

USER=$1
PASS=$2

docker compose exec api python3 -c "
import sys
from services import user_db_service, db_service
username = sys.argv[1]
new_pass = sys.argv[2]
conn = db_service.get_db_connection()
cursor = conn.cursor()
cursor.execute('SELECT email FROM users WHERE username = ?', (username,))
row = cursor.fetchone()
conn.close()
if not row:
    print('Error: user ' + username + ' not found')
    sys.exit(1)
success = user_db_service.update_user_password(row['email'], new_pass)
if success:
    print('Password updated for ' + username)
else:
    print('Failed to update password for ' + username)
    sys.exit(1)
" "$USER" "$PASS"
