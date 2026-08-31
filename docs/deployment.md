# Qualixa Production Deployment

This repository deploys the Qualixa frontend from `main` to:

```text
https://qualixa.apps.cortanexai.com
```

## Runtime

The app is a Vite React static frontend served by Nginx. Docker builds the Vite bundle and exposes Nginx on internal container port `9832`.

No host port is published. Traefik routes HTTPS traffic from the external domain to the container through the shared `coolify` Docker network.

## GitHub Actions

`Smoke Tests` runs on pull requests and pushes to `main`.

`Deploy` runs on:

- Pushes to `main`
- Manual `workflow_dispatch` from GitHub Actions

The production deployment uses:

| Setting | Value |
| --- | --- |
| Domain | `qualixa.apps.cortanexai.com` |
| URL | `https://qualixa.apps.cortanexai.com` |
| Compose project | `qualixa-production` |
| Coolify project | `qualixa` |
| Coolify environment | `production` |
| Coolify service | `qualixa-production` |
| Service application | `web` |
| Internal port | `9832` |
| Server path | `/opt/qualixa/production` |

## Required GitHub Secrets

| Secret | Purpose |
| --- | --- |
| `DEPLOY_HOST` | Server IP or hostname. |
| `DEPLOY_PORT` | SSH port, normally `22`. |
| `DEPLOY_USER` | SSH deployment user, normally `qualixa-deploy`. |
| `DEPLOY_SSH_KEY` | Private SSH key authorized for the deployment user. |
| `DEPLOY_NOTIFY_EMAIL_TO` | Mailcow recipient for deployment notifications. |
| `DEPLOY_NOTIFY_EMAIL_FROM` | Mailcow sender address for deployment notifications. |
| `DEPLOY_NOTIFY_SLACK_WEBHOOK_URL` | Slack incoming webhook URL. Store as a secret only. |
| `DEPLOY_NOTIFY_SLACK_CHANNEL` | Optional Slack channel override. |
| `DEPLOY_NOTIFY_N8N_WEBHOOK_URL` | Optional n8n webhook endpoint. |
| `DEPLOY_NOTIFY_N8N_WEBHOOK_SECRET` | Optional shared secret sent to n8n as `X-Deployment-Webhook-Secret`. |
| `VITE_SUPABASE_URL` | Public Supabase URL baked into the client build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public Supabase publishable key baked into the client build. |
| `VITE_SUPABASE_PROJECT_ID` | Public Supabase project ID baked into the client build. |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Public Paddle client token baked into the client build, if billing is enabled. |

The deployment script can read existing defaults from `.env` and `.env.production`, but production values should be managed through GitHub secrets.

## Monitoring

Coolify dashboard:

```text
https://coolify.cortanexai.com
```

Direct service page:

```text
https://coolify.cortanexai.com/project/e591a35f799b4f6b72f18391/environment/9e1d47ddd2d5362ece1d6ab5/service/68c30ba508bf0ea3cc460b4b
```

Direct logs page:

```text
https://coolify.cortanexai.com/project/e591a35f799b4f6b72f18391/environment/9e1d47ddd2d5362ece1d6ab5/service/68c30ba508bf0ea3cc460b4b/logs
```

Service logs from SSH:

```bash
docker compose -f /opt/qualixa/production/current/docker-compose.deploy.yml --env-file /opt/qualixa/production/shared/.env -p qualixa-production logs -f web
```

Container status from SSH:

```bash
docker compose -f /opt/qualixa/production/current/docker-compose.deploy.yml --env-file /opt/qualixa/production/shared/.env -p qualixa-production ps
```

The deployer keeps the newest five releases under `/opt/qualixa/production/releases`.

## Notifications

Every deployment sends success or failure details to:

- Mailcow through the local postfix container.
- Slack through the configured incoming webhook.
- n8n if `DEPLOY_NOTIFY_N8N_WEBHOOK_URL` is configured.

Notifications include environment, URL, branch, commit, actor, GitHub run URL, duration, status, and Docker Compose service state.
