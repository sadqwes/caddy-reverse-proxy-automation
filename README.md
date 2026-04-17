# Caddy Reverse Proxy Automation

[![CI](https://img.shields.io/github/actions/workflow/status/sadqwes/caddy-reverse-proxy-automation/ci.yaml?branch=main&label=CI)](https://github.com/sadqwes/caddy-reverse-proxy-automation/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](./package.json)

Infrastructure repository for managing a multi-domain Caddy reverse proxy with generated config, path-based forwarding, health checks, and simple service monitoring.

This project is useful when you want to keep reverse proxy configuration in Git, deploy changes through GitHub Actions, and add new domains by committing JSON config files instead of editing the server manually.

## Related Repositories

- [caddy-reverse-proxy-ansible](https://github.com/sadqwes/caddy-reverse-proxy-ansible) provisions the target server for this project, including Caddy installation, SSH setup, and GitHub Actions runner configuration.

## Why This Project

- One repository can manage multiple domains and subdomains.
- New proxy routes are added through small JSON files in `config/`.
- `Caddyfile` is generated automatically, which reduces manual mistakes.
- CI validates config before deployment.
- A lightweight monitoring script can alert to Slack and optionally restart services.

## Why I Built This

I wanted a small infrastructure project that solves a real operational problem: managing reverse proxy rules in a repeatable way without editing production config by hand.

This repository also serves as a portfolio project. It demonstrates:

- infrastructure-as-code thinking
- basic CI/CD automation with GitHub Actions
- config validation before deployment
- operational concerns such as health checks and service monitoring

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
Makefile
CONTRIBUTING.md
```

## Architecture

```text
config/*.json
    |
    v
validate-config.js
    |
    v
generate-caddyfile.js
    |
    v
Caddyfile
    |
    +--> caddy validate
    +--> deploy.yaml (manual, self-hosted)
    +--> health-check.js
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

## Example Generated Output

Example of what the generated `Caddyfile` looks like:

```caddyfile
api.example.com {
    handle /webhook* {
        uri replace /webhook /internal/webhooks/stripe
        reverse_proxy https://api.backend.com {
            header_up Host api.backend.com
            import common_proxy
        }
    }

    handle {
        reverse_proxy https://api.backend.com {
            header_up Host api.backend.com
            import common_proxy
        }
    }
}
```

## Local Usage

Requirements:

- Node.js 18+
- Caddy installed on the target server for validation and reload

## Minimal Server Requirements

Tested baseline for a small proxy server:

- Linux server, for example Ubuntu
- 1 vCPU
- 1 GB RAM
- 1 GB swap

This is a practical minimum for a lightweight setup with Caddy, generated config, and basic monitoring. Higher traffic or more backends may require more resources.

Commands:

```bash
npm run validate:config
npm run generate
npm run health-check
```

Or with `make`:

```bash
make validate
make generate
make health-check
```

## CI/CD

This repository includes two GitHub Actions workflows:

- `ci.yaml` validates config and generates a `Caddyfile` on push and pull request
- `deploy.yaml` is intended for a self-hosted runner and performs deployment to the server
- `deploy.yaml` runs manually via `workflow_dispatch`, which keeps the public repository green when no self-hosted runner is attached

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

## Limitations

- Deployment requires a self-hosted GitHub Actions runner
- Health checks assume public HTTPS endpoints are reachable from the runner
- The monitoring script is Linux-only and expects `systemd`
- Paths like `/etc/caddy` and `/opt/alerts` are intentionally server-oriented, not fully portable

## Contributing

Small improvements are welcome. If you want to extend the project:

1. Add or update a config example in `config/`
2. Run `make validate` and `make generate`
3. Open a pull request with a short explanation of the change

Please do not commit real domains, private backend addresses, secrets, or production `.env` files.
