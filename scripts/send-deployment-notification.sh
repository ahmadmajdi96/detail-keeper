#!/usr/bin/env bash
set -uo pipefail

# Sends deployment notifications by email, Slack, and optionally n8n.
# Failures here are intentionally non-fatal so the real deployment result stays visible.

get_notify_config() {
  local key="$1"
  local default="${2:-}"
  local value="${!key:-}"

  if [ -z "${value}" ] && [ -n "${NOTIFY_ENV_FILE:-}" ] && [ -f "${NOTIFY_ENV_FILE}" ]; then
    value="$(grep -m1 "^${key}=" "${NOTIFY_ENV_FILE}" | sed 's/^[^=]*=//' || true)"
  fi

  if [ -z "${value}" ]; then
    value="${default}"
  fi

  printf '%s' "${value}"
}

deployment_status="$(printf '%s' "${DEPLOY_STATUS:-unknown}" | tr '[:lower:]' '[:upper:]')"
deployment_exit_code="${DEPLOY_EXIT_CODE:-0}"
deployment_detail="${DEPLOY_NOTIFY_DETAIL:-Deployment status was reported by the deployment runner.}"
started_at="${DEPLOY_STARTED_AT:-unknown}"
finished_at="${DEPLOY_FINISHED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
duration="${DEPLOY_DURATION_SECONDS:-unknown}"
app_display_name="${APP_DISPLAY_NAME:-Application}"
repository="${GITHUB_REPOSITORY:-unknown}"
branch="${GITHUB_REF_NAME:-unknown}"
actor="${GITHUB_ACTOR:-unknown}"
workflow="${GITHUB_WORKFLOW:-Deploy}"
event_name="${GITHUB_EVENT_NAME:-unknown}"
server_url="${GITHUB_SERVER_URL:-https://github.com}"
run_id="${GITHUB_RUN_ID:-}"
run_number="${GITHUB_RUN_NUMBER:-unknown}"
run_attempt="${GITHUB_RUN_ATTEMPT:-unknown}"
commit_sha="${APP_VERSION:-${GITHUB_SHA:-unknown}}"
short_sha="${commit_sha:0:7}"
environment="${APP_ENV:-unknown}"
app_url="${APP_URL:-unknown}"
app_domain="${APP_DOMAIN:-unknown}"
project_name="${PROJECT_NAME:-unknown}"
run_url="${server_url}/${repository}/actions/runs/${run_id}"

compose_ps="Not available"
if [ -n "${COMPOSE_FILE:-}" ] && [ -f "${COMPOSE_FILE}" ] && [ -n "${PROJECT_NAME:-}" ]; then
  compose_dir="$(dirname "${COMPOSE_FILE}")"
  compose_ps="$(
    cd "${compose_dir}" \
      && docker compose -f "${COMPOSE_FILE}" --env-file .env -p "${PROJECT_NAME}" ps 2>&1 \
      | sed -n '1,80p'
  )"
fi

subject="[${app_display_name} deploy] ${deployment_status} ${environment} ${short_sha}"

email_body="$(
  cat <<EOF
${app_display_name} deployment ${deployment_status}

Status: ${deployment_status}
Exit code: ${deployment_exit_code}
Environment: ${environment}
URL: ${app_url}
Domain: ${app_domain}
Compose project: ${project_name}

Repository: ${repository}
Branch: ${branch}
Commit: ${commit_sha}
Actor: ${actor}
Event: ${event_name}
Workflow: ${workflow}
Run number: ${run_number}
Run attempt: ${run_attempt}
Run URL: ${run_url}

Started: ${started_at}
Finished: ${finished_at}
Duration seconds: ${duration}

Detail:
${deployment_detail}

Docker status:
${compose_ps}
EOF
)"

send_mailcow_email() {
  local enabled
  local to
  local from
  local message

  enabled="$(get_notify_config DEPLOY_NOTIFY_EMAIL_ENABLED true)"
  if [ "${enabled}" = "false" ] || [ "${enabled}" = "0" ]; then
    return 0
  fi

  to="$(get_notify_config DEPLOY_NOTIFY_EMAIL_TO "deployments@example.com")"
  from="$(get_notify_config DEPLOY_NOTIFY_EMAIL_FROM "github@example.com")"
  if [ -z "${to}" ]; then
    return 0
  fi

  message="$(
    cat <<EOF
From: ${app_display_name} Deployments <${from}>
To: ${to}
Subject: ${subject}
Content-Type: text/plain; charset=UTF-8

${email_body}
EOF
)"

  if docker ps --format '{{.Names}}' | grep -qx 'mailcowdockerized-postfix-mailcow-1'; then
    printf '%s\n' "${message}" | docker exec -i mailcowdockerized-postfix-mailcow-1 sendmail -t >/dev/null 2>&1
  elif command -v sendmail >/dev/null 2>&1; then
    printf '%s\n' "${message}" | sendmail -t >/dev/null 2>&1
  else
    echo "No local sendmail transport found for deployment email notification" >&2
  fi
}

build_slack_payload() {
  SLACK_APP_NAME="${app_display_name}" \
  SLACK_CHANNEL="$(get_notify_config DEPLOY_NOTIFY_SLACK_CHANNEL "")" \
  SLACK_STATUS="${deployment_status}" \
  SLACK_ENVIRONMENT="${environment}" \
  SLACK_BRANCH="${branch}" \
  SLACK_COMMIT="${short_sha}" \
  SLACK_ACTOR="${actor}" \
  SLACK_APP_URL="${app_url}" \
  SLACK_RUN_URL="${run_url}" \
  SLACK_DETAIL="${deployment_detail}" \
  python3 <<'PY'
import json
import os

status = os.environ["SLACK_STATUS"]
emoji = ":white_check_mark:" if status == "SUCCESS" else ":x:" if status == "FAILURE" else ":information_source:"
app_name = os.environ["SLACK_APP_NAME"]
payload = {
    "text": f"{emoji} {app_name} deployment {status} for {os.environ['SLACK_ENVIRONMENT']}",
    "blocks": [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"{app_name} deployment {status}"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Environment:*\n{os.environ['SLACK_ENVIRONMENT']}"},
                {"type": "mrkdwn", "text": f"*Branch:*\n{os.environ['SLACK_BRANCH']}"},
                {"type": "mrkdwn", "text": f"*Commit:*\n{os.environ['SLACK_COMMIT']}"},
                {"type": "mrkdwn", "text": f"*Actor:*\n{os.environ['SLACK_ACTOR']}"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*App:* {os.environ['SLACK_APP_URL']}\n*Run:* {os.environ['SLACK_RUN_URL']}\n*Detail:* {os.environ['SLACK_DETAIL']}",
            },
        },
    ],
}

channel = os.environ.get("SLACK_CHANNEL", "")
if channel:
    payload["channel"] = channel

print(json.dumps(payload))
PY
}

build_n8n_payload() {
  DEPLOYMENT_JSON_EMAIL_BODY="${email_body}" python3 <<'PY'
import json
import os

keys = [
    "DEPLOY_STATUS",
    "DEPLOY_EXIT_CODE",
    "DEPLOY_NOTIFY_DETAIL",
    "DEPLOY_STARTED_AT",
    "DEPLOY_FINISHED_AT",
    "DEPLOY_DURATION_SECONDS",
    "APP_ENV",
    "APP_URL",
    "APP_DOMAIN",
    "PROJECT_NAME",
    "APP_VERSION",
    "GITHUB_REPOSITORY",
    "GITHUB_REF_NAME",
    "GITHUB_ACTOR",
    "GITHUB_EVENT_NAME",
    "GITHUB_WORKFLOW",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_NUMBER",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_SERVER_URL",
]
payload = {key: os.environ.get(key, "") for key in keys}
payload["app_display_name"] = os.environ.get("APP_DISPLAY_NAME", "")
payload["email_body"] = os.environ.get("DEPLOYMENT_JSON_EMAIL_BODY", "")
payload["run_url"] = f"{payload['GITHUB_SERVER_URL']}/{payload['GITHUB_REPOSITORY']}/actions/runs/{payload['GITHUB_RUN_ID']}"
print(json.dumps(payload))
PY
}

send_slack_notification() {
  local webhook
  local payload

  webhook="$(get_notify_config DEPLOY_NOTIFY_SLACK_WEBHOOK_URL "")"
  if [ -z "${webhook}" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to build Slack notification payloads" >&2
    return 0
  fi

  payload="$(build_slack_payload)"
  curl -fsS --retry 2 --connect-timeout 10 \
    -H 'Content-Type: application/json' \
    --data "${payload}" \
    "${webhook}" >/dev/null 2>&1
}

send_n8n_webhook() {
  local webhook
  local secret
  local payload
  local headers

  webhook="$(get_notify_config DEPLOY_NOTIFY_N8N_WEBHOOK_URL "")"
  if [ -z "${webhook}" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to build n8n notification payloads" >&2
    return 0
  fi

  secret="$(get_notify_config DEPLOY_NOTIFY_N8N_WEBHOOK_SECRET "")"
  payload="$(build_n8n_payload)"
  headers=(-H 'Content-Type: application/json')
  if [ -n "${secret}" ]; then
    headers+=(-H "X-Deployment-Webhook-Secret: ${secret}")
  fi

  curl -fsS --retry 2 --connect-timeout 10 \
    "${headers[@]}" \
    --data "${payload}" \
    "${webhook}" >/dev/null 2>&1
}

main() {
  local enabled

  enabled="$(get_notify_config DEPLOY_NOTIFY_ENABLED true)"
  if [ "${enabled}" = "false" ] || [ "${enabled}" = "0" ]; then
    exit 0
  fi

  send_mailcow_email || true
  send_slack_notification || true
  send_n8n_webhook || true
}

main "$@"
