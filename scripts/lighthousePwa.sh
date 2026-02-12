#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
URL="http://127.0.0.1:${PORT}/life-shield_2_0/#/"

npm run build >/tmp/life-shield-lighthouse-build.log 2>&1
npm run preview -- --host 0.0.0.0 --port "${PORT}" --strictPort >/tmp/life-shield-lighthouse-preview.log 2>&1 &
PREVIEW_PID=$!

cleanup() {
  if kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  code=$(curl -s -o /tmp/life-shield-lighthouse-root.html -w "%{http_code}" "http://127.0.0.1:${PORT}/" || true)
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
    break
  fi
  sleep 1
done

npx --yes lighthouse "$URL" \
  --only-categories=pwa,performance \
  --preset=desktop \
  --throttling-method=simulate \
  --output=html \
  --output=json \
  --output-path=./lighthouse-pwa-report \
  --chrome-flags="--headless=new --no-sandbox"
