#!/bin/sh
set -e

mkdir -p /data

bun /app/server/index.ts &

exec nginx -g 'daemon off;'
