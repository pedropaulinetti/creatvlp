#!/usr/bin/env bash
# Publica as Edge Functions do CreatvOS.
#
# Uso:  SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... bash scripts/deploy-functions.sh [slug...]
#
# Usa a Management API porque o CLI ainda recusa tokens no formato `sbp_v0_`.
# Com um token no formato antigo, `supabase functions deploy` também funciona.
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
PROJECT_REF="${PROJECT_REF:-hqmhxoismhzcrytkqdpi}"

cd "$(dirname "$0")/../supabase/functions"

SHARED_ARGS=()
for f in _shared/*.ts; do SHARED_ARGS+=(-F "file=@$f;filename=$f"); done

SLUGS=("$@")
if [ ${#SLUGS[@]} -eq 0 ]; then
  SLUGS=(analyze-brand campaign-chat generate-directions generate-copies generate-image \
         regenerate-asset record-performance recommend-next-test admin-retry-job run-routines)
fi

for slug in "${SLUGS[@]}"; do
  # run-routines é chamada pelo cron, sem JWT de usuário; valida o segredo por conta própria.
  if [ "$slug" = "run-routines" ]; then VJ=false; else VJ=true; fi

  code=$(curl -s -o /tmp/creatvos-deploy.json -w "%{http_code}" \
    -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/deploy?slug=$slug" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -F "metadata={\"name\":\"$slug\",\"entrypoint_path\":\"$slug/index.ts\",\"verify_jwt\":$VJ};type=application/json" \
    -F "file=@$slug/index.ts;filename=$slug/index.ts" \
    "${SHARED_ARGS[@]}")

  if [ "$code" = "201" ] || [ "$code" = "200" ]; then
    echo "publicada  $slug (verify_jwt=$VJ)"
  else
    echo "FALHOU     $slug [HTTP $code]" >&2
    head -c 400 /tmp/creatvos-deploy.json >&2; echo >&2
    exit 1
  fi
done
