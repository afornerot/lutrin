#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <username> <password> <email> [role]"
    exit 1
fi

USER=$1
PASS=$2
EMAIL=$3
ROLE=${4:-USER}

docker compose exec api python3 -c "
import sys
from services import user_db_service, db_service
success = user_db_service.add_user(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
if success:
    print('User ' + sys.argv[1] + ' added successfully')
else:
    print('Failed to add user ' + sys.argv[1])
    sys.exit(1)
" "$USER" "$PASS" "$EMAIL" "$ROLE"
