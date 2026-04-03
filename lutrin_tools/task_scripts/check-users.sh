#!/bin/bash
set -e

USER_COUNT=$(docker compose run --rm api python3 -c "
from services import user_db_service
print(user_db_service.count_users())
" 2>/dev/null | tail -1)

if [ "$USER_COUNT" -eq 0 ]; then
    echo "No users found. Creating admin account."
    read -p "Username for admin: " admin_user
    while [ -z "$admin_user" ]; do
        echo "Username cannot be empty."
        read -p "Username for admin: " admin_user
    done
    read -sp "Password for admin (hidden): " admin_pass
    echo
    while [ -z "$admin_pass" ]; do
        echo "Password cannot be empty."
        read -sp "Password for admin (hidden): " admin_pass
        echo
    done
    read -p "Email for admin: " admin_email
    while [ -z "$admin_email" ]; do
        echo "Email cannot be empty."
        read -p "Email for admin: " admin_email
    done
    docker compose run --rm api python3 -c "
from services import user_db_service, db_service
db_service.init_db()
success, message = user_db_service.add_user('$admin_user', '$admin_pass', '$admin_email', 'ADMIN')
print(message)
"
else
    echo "Users already exist ($USER_COUNT users)."
fi