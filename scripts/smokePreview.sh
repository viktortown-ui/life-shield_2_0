#!/usr/bin/env bash
set -euo pipefail

PORT=4173
ROOT_URL="http://127.0.0.1:${PORT}/"
FALLBACK_BASE_URL="http://127.0.0.1:${PORT}/life-shield_2_0/"
TARGET_URL="$ROOT_URL"

npm run build
npm run preview -- --host 0.0.0.0 --port ${PORT} --strictPort >/tmp/life-shield-preview.log 2>&1 &
PREVIEW_PID=$!

cleanup() {
  if kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  code=$(curl -s -o /tmp/life-shield-preview-root.html -w "%{http_code}" "$ROOT_URL" || true)
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" ]]; then
    break
  fi
  sleep 1
done

root_code=$(curl -s -o /tmp/life-shield-preview-root.html -w "%{http_code}" "$ROOT_URL")
if [[ "$root_code" == "301" || "$root_code" == "302" ]]; then
  TARGET_URL="$FALLBACK_BASE_URL"
fi

code=$(curl -s -L -o /tmp/life-shield-preview.html -w "%{http_code}" "$TARGET_URL")
if [[ "$code" != "200" ]]; then
  echo "Preview did not become ready. Last status: $code"
  echo "---- preview log ----"
  cat /tmp/life-shield-preview.log
  exit 1
fi

if rg -q "diagnostics-panel|build-footer" /tmp/life-shield-preview.html; then
  echo "Unexpected diagnostics/build footer in production preview output."
  exit 1
fi

echo "Smoke preview check passed for ${TARGET_URL}."
