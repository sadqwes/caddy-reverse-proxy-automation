# Caddy Reverse Proxy Automation

Infrastructure repository for managing a multi-domain Caddy reverse proxy with generated config, path-based forwarding, health checks, and simple service monitoring.

This project is useful when you want to keep reverse proxy configuration in Git, deploy changes through GitHub Actions, and add new domains by committing JSON config files instead of editing the server manually.

## Why This Project

- One repository can manage multiple domains and subdomains.
- New proxy routes are added through small JSON files in `config/`.
- `Caddyfile` is generated automatically, which reduces manual mistakes.
- CI validates config before deployment.
- A lightweight monitoring script can alert to Slack and optionally restart services.

## Features

- Multi-domain reverse proxy generation for Caddy
- Path forwarding without redirects
- Config validation before deployment
- Automated health checks for all configured subdomains
- GitHub Actions workflow for validation and deployment
- Optional service monitoring with Slack notifications

## Project Structure

```text
.github/workflows/
  ci.yaml
  deploy.yaml
config/
  config.example.json
  config.example2.json
opt/
  check_services.sh
scripts/
  generate-caddyfile.js
  health-check.js
  validate-config.js
```

## How It Works

Each JSON file in `config/` describes one domain and its subdomains. The generator reads all config files and builds a single `Caddyfile`.

Adding a new domain usually means:

1. Create a new JSON file in `config/`
2. Validate config locally or in CI
3. Generate and deploy the updated `Caddyfile`

## Configuration Format

Minimal example:

```json
{
  "domain": "example.com",
  "subdomains": {
    "app": "app.backend.com",
    "api": "api.backend.com"
  }
}
```

Example with path forwarding:

```json
{
  "domain": "example.com",
  "subdomains": {
    "api": {
      "target": "api.backend.com",
      "forwardRoutes": {
        "/webhook": "/internal/webhooks/stripe",
        "/telegram": "/internal/webhooks/telegram"
      }
    }
  }
}
```

Behavior:

```text
POST /webhook       -> /internal/webhooks/stripe
POST /webhook/test  -> /internal/webhooks/stripe/test
```

Supported target formats:

```json
"api": "api.domain.com"
"api": "https://api.domain.com"
"api": "http://217.114.10.17"
```

## Local Usage

Requirements:

- Node.js 18+
- Caddy installed on the target server for validation and reload

Commands:

```bash
npm run validate:config
npm run generate
npm run health-check
```

## CI/CD

This repository includes two GitHub Actions workflows:

- `ci.yaml` validates config and generates a `Caddyfile` on push and pull request
- `deploy.yaml` is intended for a self-hosted runner and performs deployment to the server

Deployment flow:

1. Validate JSON config
2. Generate `Caddyfile`
3. Validate Caddy config
4. Copy config to `/etc/caddy/Caddyfile`
5. Reload Caddy
6. Run health checks

## Health Check

The health-check script sends `HEAD` requests to all configured subdomains.

Healthy responses:

```text
200-499
```

Failure conditions:

- Network error
- Timeout
- Any `5xx` response

## Service Monitoring

The optional monitoring script checks systemd services, sends Slack notifications, and can auto-restart selected services.

Install:

```bash
sudo mkdir -p /opt/alerts
sudo cp opt/check_services.sh /opt/alerts/check-services.sh
sudo chmod +x /opt/alerts/check-services.sh
```

Environment file example:

```env
SLACK_WEBHOOK_URL=
SERVICES=caddy.service,actions.runner.service
AUTO_RESTART_SERVICES=caddy.service
STATE_DIR=/opt/alerts
ALERT_HOSTNAME=proxy-host
```

Example cron entry:

```bash
* * * * * /opt/alerts/check-services.sh >> /var/log/service-monitor.log 2>&1
```

Behavior:

- Sends one alert when a service goes down
- Sends recovery alert when the service is back
- Avoids alert spam by storing state files
- Optionally attempts service restart before notifying about a hard failure
