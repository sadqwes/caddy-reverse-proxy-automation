# Contributing

Thanks for checking out this repository.

## Local workflow

1. Update or add config examples in `config/`
2. Run `make validate`
3. Run `make generate`
4. If needed, run `npm run health-check` against real public endpoints

## Guidelines

- Keep example configs sanitized
- Do not commit secrets, real `.env` files, or internal-only infrastructure details
- Prefer small, focused pull requests
- Update `README.md` when behavior or config format changes

## Scope

This project is intentionally small and focused on:

- Caddy reverse proxy config generation
- validation and health checks
- practical CI/CD for a self-hosted deployment setup
