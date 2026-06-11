#!/bin/sh
set -e

printf "Admin username [admin]: "
read USERNAME
USERNAME="${USERNAME:-admin}"

printf "New password: "
stty -echo
read PASSWORD
stty echo
printf "\n"

if [ -z "$PASSWORD" ]; then
  echo "Error: password cannot be empty"
  exit 1
fi

echo "Setting Fly.io secrets..."
fly secrets set ADMIN_USERNAME="$USERNAME" ADMIN_PASSWORD="$PASSWORD"
echo "Done. Deploy with: fly deploy"
