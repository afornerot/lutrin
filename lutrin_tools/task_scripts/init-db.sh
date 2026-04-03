#!/bin/bash
set -e

docker compose run --rm api python3 -c "
from services import db_service
db_service.init_db()
print('Database initialized.')
"