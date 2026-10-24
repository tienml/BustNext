#!/usr/bin/env bash
set -euo pipefail
cd /mnt/d/BusNext
docker compose up -d
sleep 8
cd backend
php artisan db:seed --force >/dev/null
cd ../fixtures/gtfs/dataset-a-v1
rm -f /tmp/dataset-a-v1.zip
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path('.')
with ZipFile('/tmp/dataset-a-v1.zip', 'w', ZIP_DEFLATED) as archive:
    for path in root.glob('*.txt'):
        archive.write(path, path.name)
PY
cd ../../../backend
php artisan serve --host=127.0.0.1 --port=8140 >/tmp/busfast-api.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 5
curl -sS -F 'file=@/tmp/dataset-a-v1.zip;type=application/zip' -F 'label=Imported fixture' http://127.0.0.1:8140/api/v1/datasets/1/versions
printf '\n'
