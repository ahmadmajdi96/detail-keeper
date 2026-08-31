#!/usr/bin/env bash
set -euo pipefail

: "${APP_SLUG:?APP_SLUG is required, for example qualixa}"
: "${APP_ENV:?APP_ENV is required}"
: "${APP_DOMAIN:?APP_DOMAIN is required}"
: "${APP_URL:?APP_URL is required}"
: "${PROJECT_NAME:?PROJECT_NAME is required}"
: "${APP_VERSION:?APP_VERSION is required}"
: "${ARCHIVE_NAME:?ARCHIVE_NAME is required}"

APP_DISPLAY_NAME="${APP_DISPLAY_NAME:-Qualixa}"
APP_PORT="${APP_PORT:-9832}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/${APP_SLUG}}"
COMPOSE_FILE_NAME="${COMPOSE_FILE_NAME:-docker-compose.deploy.yml}"
HEALTH_PATH="${HEALTH_PATH:-/}"
COOLIFY_PROJECT_NAME="${COOLIFY_PROJECT_NAME:-qualixa}"
COOLIFY_SERVICE_NAME="${COOLIFY_SERVICE_NAME:-qualixa-${APP_ENV}}"
APP_ROOT="${DEPLOY_ROOT}/${APP_ENV}"
RELEASES_DIR="${APP_ROOT}/releases"
SHARED_DIR="${APP_ROOT}/shared"
RELEASE_DIR="${RELEASES_DIR}/${APP_VERSION}"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
COMPOSE_FILE="${RELEASE_DIR}/${COMPOSE_FILE_NAME}"
ENV_FILE="${SHARED_DIR}/.env"
NOTIFY_ENV_FILE="${SHARED_DIR}/notify.env"
DEPLOY_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOY_STARTED_SECONDS="$(date -u +%s)"
DEPLOY_STATUS="failure"
DEPLOY_NOTIFY_DETAIL="Initializing deployment"
DEPLOY_NOTIFICATION_SENT="false"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on the target host" >&2
  exit 1
fi

if ! docker network inspect coolify >/dev/null 2>&1; then
  echo "Coolify docker network 'coolify' was not found" >&2
  exit 1
fi

mkdir -p "${RELEASE_DIR}" "${SHARED_DIR}"
DEPLOY_NOTIFY_DETAIL="Unpacking release archive"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_DIR}"

upsert_file_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped

  escaped="$(printf '%s' "${value}" | sed -e 's/[\/&]/\\&/g')"
  if grep -q "^${key}=" "${file}"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

ensure_notify_env() {
  if [ ! -f "${NOTIFY_ENV_FILE}" ]; then
    umask 077
    {
      printf 'DEPLOY_NOTIFY_ENABLED=true\n'
      printf 'DEPLOY_NOTIFY_EMAIL_ENABLED=true\n'
      printf 'DEPLOY_NOTIFY_EMAIL_FROM=github@cortanexai.com\n'
      printf 'DEPLOY_NOTIFY_EMAIL_TO=a.salameh@cortanexai.com\n'
      printf 'DEPLOY_NOTIFY_SLACK_WEBHOOK_URL=\n'
      printf 'DEPLOY_NOTIFY_SLACK_CHANNEL=\n'
      printf 'DEPLOY_NOTIFY_N8N_WEBHOOK_URL=\n'
      printf 'DEPLOY_NOTIFY_N8N_WEBHOOK_SECRET=\n'
    } > "${NOTIFY_ENV_FILE}"
  fi
  chmod 600 "${NOTIFY_ENV_FILE}"
}

decode_b64() {
  printf '%s' "$1" | base64 -d
}

set_var_from_b64() {
  local key="$1"
  local b64_key="$2"
  local b64_value="${!b64_key:-}"
  local value

  if [ -z "${b64_value}" ]; then
    return
  fi

  value="$(decode_b64 "${b64_value}")"
  printf -v "${key}" '%s' "${value}"
  export "${key}"
}

upsert_notify_from_b64() {
  local key="$1"
  local b64_key="$2"
  local b64_value="${!b64_key:-}"
  local value

  if [ -z "${b64_value}" ]; then
    return
  fi

  value="$(decode_b64 "${b64_value}")"
  if [ -n "${value}" ]; then
    upsert_file_env "${NOTIFY_ENV_FILE}" "${key}" "${value}"
  fi
}

configure_github_metadata() {
  set_var_from_b64 GITHUB_REPOSITORY GITHUB_REPOSITORY_B64
  set_var_from_b64 GITHUB_REF_NAME GITHUB_REF_NAME_B64
  set_var_from_b64 GITHUB_SHA GITHUB_SHA_B64
  set_var_from_b64 GITHUB_ACTOR GITHUB_ACTOR_B64
  set_var_from_b64 GITHUB_EVENT_NAME GITHUB_EVENT_NAME_B64
  set_var_from_b64 GITHUB_WORKFLOW GITHUB_WORKFLOW_B64
  set_var_from_b64 GITHUB_RUN_ID GITHUB_RUN_ID_B64
  set_var_from_b64 GITHUB_RUN_NUMBER GITHUB_RUN_NUMBER_B64
  set_var_from_b64 GITHUB_RUN_ATTEMPT GITHUB_RUN_ATTEMPT_B64
  set_var_from_b64 GITHUB_SERVER_URL GITHUB_SERVER_URL_B64
}

configure_runtime_secrets() {
  set_var_from_b64 VITE_SUPABASE_URL VITE_SUPABASE_URL_B64
  set_var_from_b64 VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PUBLISHABLE_KEY_B64
  set_var_from_b64 VITE_SUPABASE_PROJECT_ID VITE_SUPABASE_PROJECT_ID_B64
  set_var_from_b64 VITE_PAYMENTS_CLIENT_TOKEN VITE_PAYMENTS_CLIENT_TOKEN_B64
}

configure_notifications() {
  ensure_notify_env
  upsert_notify_from_b64 DEPLOY_NOTIFY_EMAIL_TO DEPLOY_NOTIFY_EMAIL_TO_B64
  upsert_notify_from_b64 DEPLOY_NOTIFY_EMAIL_FROM DEPLOY_NOTIFY_EMAIL_FROM_B64
  upsert_notify_from_b64 DEPLOY_NOTIFY_SLACK_WEBHOOK_URL DEPLOY_NOTIFY_SLACK_WEBHOOK_URL_B64
  upsert_notify_from_b64 DEPLOY_NOTIFY_SLACK_CHANNEL DEPLOY_NOTIFY_SLACK_CHANNEL_B64
  upsert_notify_from_b64 DEPLOY_NOTIFY_N8N_WEBHOOK_URL DEPLOY_NOTIFY_N8N_WEBHOOK_URL_B64
  upsert_notify_from_b64 DEPLOY_NOTIFY_N8N_WEBHOOK_SECRET DEPLOY_NOTIFY_N8N_WEBHOOK_SECRET_B64
}

notify_on_exit() {
  local exit_code="$1"
  local finished_seconds
  local notification_script

  if [ "${DEPLOY_NOTIFICATION_SENT}" = "true" ]; then
    return
  fi
  DEPLOY_NOTIFICATION_SENT="true"

  set +e
  finished_seconds="$(date -u +%s)"
  DEPLOY_EXIT_CODE="${exit_code}"
  DEPLOY_FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  DEPLOY_DURATION_SECONDS="$((finished_seconds - DEPLOY_STARTED_SECONDS))"
  if [ "${exit_code}" -eq 0 ]; then
    DEPLOY_STATUS="${DEPLOY_STATUS:-success}"
  else
    DEPLOY_STATUS="failure"
  fi

  export APP_DISPLAY_NAME APP_ENV APP_DOMAIN APP_URL PROJECT_NAME APP_VERSION
  export GITHUB_REPOSITORY GITHUB_REF_NAME GITHUB_SHA GITHUB_ACTOR GITHUB_EVENT_NAME
  export GITHUB_WORKFLOW GITHUB_RUN_ID GITHUB_RUN_NUMBER GITHUB_RUN_ATTEMPT GITHUB_SERVER_URL
  export DEPLOY_STATUS DEPLOY_EXIT_CODE DEPLOY_NOTIFY_DETAIL DEPLOY_STARTED_AT DEPLOY_FINISHED_AT DEPLOY_DURATION_SECONDS
  export NOTIFY_ENV_FILE COMPOSE_FILE RELEASE_DIR

  notification_script="${RELEASE_DIR}/scripts/send-deployment-notification.sh"
  if [ ! -f "${notification_script}" ] && [ -f "${APP_ROOT}/current/scripts/send-deployment-notification.sh" ]; then
    notification_script="${APP_ROOT}/current/scripts/send-deployment-notification.sh"
  fi

  if [ -f "${notification_script}" ]; then
    bash "${notification_script}" || true
  else
    echo "Deployment notification script was not found" >&2
  fi
}

read_default_env() {
  local key="$1"
  local file

  for file in "${RELEASE_DIR}/.env.production" "${RELEASE_DIR}/.env" "${RELEASE_DIR}/.env.development"; do
    if [ -f "${file}" ]; then
      grep -m1 "^${key}=" "${file}" | sed 's/^[^=]*=//' && return 0
    fi
  done

  return 0
}

ensure_runtime_env() {
  local vite_url_value
  local vite_key_value
  local vite_project_value
  local payments_token_value

  vite_url_value="${VITE_SUPABASE_URL:-$(read_default_env VITE_SUPABASE_URL)}"
  vite_key_value="${VITE_SUPABASE_PUBLISHABLE_KEY:-$(read_default_env VITE_SUPABASE_PUBLISHABLE_KEY)}"
  vite_project_value="${VITE_SUPABASE_PROJECT_ID:-$(read_default_env VITE_SUPABASE_PROJECT_ID)}"
  payments_token_value="${VITE_PAYMENTS_CLIENT_TOKEN:-$(read_default_env VITE_PAYMENTS_CLIENT_TOKEN)}"

  : "${vite_url_value:?VITE_SUPABASE_URL is required}"
  : "${vite_key_value:?VITE_SUPABASE_PUBLISHABLE_KEY is required}"
  : "${vite_project_value:?VITE_SUPABASE_PROJECT_ID is required}"

  if [ ! -f "${ENV_FILE}" ]; then
    umask 077
    : > "${ENV_FILE}"
  fi
  chmod 600 "${ENV_FILE}"

  upsert_file_env "${ENV_FILE}" PROJECT_NAME "${PROJECT_NAME}"
  upsert_file_env "${ENV_FILE}" APP_DOMAIN "${APP_DOMAIN}"
  upsert_file_env "${ENV_FILE}" APP_URL "${APP_URL}"
  upsert_file_env "${ENV_FILE}" PUBLIC_BASE_URL "${APP_URL}"
  upsert_file_env "${ENV_FILE}" APP_ENV "${APP_ENV}"
  upsert_file_env "${ENV_FILE}" NODE_ENV "production"
  upsert_file_env "${ENV_FILE}" APP_PORT "${APP_PORT}"
  upsert_file_env "${ENV_FILE}" VITE_SUPABASE_URL "${vite_url_value}"
  upsert_file_env "${ENV_FILE}" VITE_SUPABASE_PUBLISHABLE_KEY "${vite_key_value}"
  upsert_file_env "${ENV_FILE}" VITE_SUPABASE_PROJECT_ID "${vite_project_value}"

  if [ -n "${payments_token_value}" ]; then
    upsert_file_env "${ENV_FILE}" VITE_PAYMENTS_CLIENT_TOKEN "${payments_token_value}"
  elif ! grep -q '^VITE_PAYMENTS_CLIENT_TOKEN=' "${ENV_FILE}"; then
    upsert_file_env "${ENV_FILE}" VITE_PAYMENTS_CLIENT_TOKEN ""
  fi
}

escape_sql() {
  printf '%s' "$1" | sed "s/'/''/g"
}

lookup_coolify_metadata() {
  if ! docker ps --format '{{.Names}}' | grep -qx 'coolify-db'; then
    echo "Coolify database container was not found; dashboard labels will use fallback metadata" >&2
    return
  fi

  local env_name
  local project_name
  local service_name
  local sql
  local rows

  env_name="$(escape_sql "${APP_ENV}")"
  project_name="$(escape_sql "${COOLIFY_PROJECT_NAME}")"
  service_name="$(escape_sql "${COOLIFY_SERVICE_NAME}")"
  sql="
select s.id, s.uuid, sa.name, sa.id
from services s
join environments e on e.id = s.environment_id
join projects p on p.id = e.project_id
join service_applications sa on sa.service_id = s.id and sa.deleted_at is null
where p.team_id = 0
  and p.name = '${project_name}'
  and e.name = '${env_name}'
  and s.name = '${service_name}'
  and s.deleted_at is null
order by sa.name;
"
  rows="$(docker exec -i coolify-db psql -U coolify -d coolify -At -F '|' 2>/dev/null <<< "${sql}" || true)"
  if [ -z "${rows}" ]; then
    echo "Coolify dashboard metadata was not found for ${APP_ENV}; dashboard labels will use fallback metadata" >&2
    return
  fi

  upsert_file_env "${ENV_FILE}" COOLIFY_PROJECT_NAME "${COOLIFY_PROJECT_NAME}"
  upsert_file_env "${ENV_FILE}" COOLIFY_RESOURCE_NAME "${COOLIFY_SERVICE_NAME}"
  upsert_file_env "${ENV_FILE}" COOLIFY_ENVIRONMENT_NAME "${APP_ENV}"
  upsert_file_env "${ENV_FILE}" COOLIFY_VERSION "${COOLIFY_VERSION:-4.3.10}"

  while IFS='|' read -r service_id service_uuid sub_name sub_id; do
    [ -n "${service_id}" ] || continue
    upsert_file_env "${ENV_FILE}" COOLIFY_SERVICE_ID "${service_id}"
    upsert_file_env "${ENV_FILE}" COOLIFY_SERVICE_UUID "${service_uuid}"
    case "${sub_name}" in
      web) upsert_file_env "${ENV_FILE}" COOLIFY_WEB_SUB_ID "${sub_id}" ;;
    esac
  done <<< "${rows}"
}

configure_github_metadata
configure_runtime_secrets
configure_notifications
trap 'notify_on_exit "$?"' EXIT

DEPLOY_NOTIFY_DETAIL="Synchronizing runtime environment"
ensure_runtime_env

DEPLOY_NOTIFY_DETAIL="Synchronizing Coolify dashboard metadata"
lookup_coolify_metadata

DEPLOY_NOTIFY_DETAIL="Preparing Docker Compose release"
cp "${ENV_FILE}" "${RELEASE_DIR}/.env"
cp "${ENV_FILE}" "${RELEASE_DIR}/.env.production"

cd "${RELEASE_DIR}"
DEPLOY_NOTIFY_DETAIL="Validating Docker Compose configuration"
docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" config >/dev/null

DEPLOY_NOTIFY_DETAIL="Building Docker image"
docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" build web

if docker network inspect "${PROJECT_NAME}_internal" >/dev/null 2>&1; then
  DEPLOY_NOTIFY_DETAIL="Detaching stale proxy network connection"
  docker network disconnect "${PROJECT_NAME}_internal" coolify-proxy >/dev/null 2>&1 || true
fi

DEPLOY_NOTIFY_DETAIL="Stopping previous containers"
docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" down --remove-orphans || true
if docker network inspect "${PROJECT_NAME}_internal" >/dev/null 2>&1; then
  DEPLOY_NOTIFY_DETAIL="Removing stale internal network"
  docker network rm "${PROJECT_NAME}_internal" >/dev/null 2>&1 || true
fi

DEPLOY_NOTIFY_DETAIL="Starting web service"
docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" up -d --remove-orphans web

DEPLOY_NOTIFY_DETAIL="Promoting release"
ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
rm -f "${ARCHIVE_PATH}"

DEPLOY_NOTIFY_DETAIL="Waiting for HTTPS endpoint"
for attempt in $(seq 1 60); do
  if curl -kfsS --resolve "${APP_DOMAIN}:443:127.0.0.1" "${APP_URL}${HEALTH_PATH}" >/dev/null; then
    break
  fi

  if [ "${attempt}" -eq 60 ]; then
    echo "Timed out waiting for ${APP_URL}${HEALTH_PATH}" >&2
    docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" ps
    exit 1
  fi

  sleep 2
done

DEPLOY_NOTIFY_DETAIL="Cleaning old releases"
find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | awk 'NR > 5 {print $2}' \
  | xargs -r rm -rf

DEPLOY_NOTIFY_DETAIL="Deployment completed; HTTPS endpoint validated"
DEPLOY_STATUS="success"
docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" ps
