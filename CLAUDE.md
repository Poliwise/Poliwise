# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
- **Install dependencies**: `pnpm install` (run in `frontend/web`)
- **Build**: `pnpm run build` (produces production assets)
- **Start development server**: `pnpm dev` (hot‑reloading UI)
- **Run all tests**: `pnpm test`
- **Run a single test**: `pnpm test -- -t "<test name>"`
- **Lint**: `pnpm lint`
- **Generate API client** (if applicable): `pnpm run generate:api`

## High‑Level Architecture
- **Frontend** (`frontend/web`): Next.js application using TypeScript. Entry point is `frontend/web/app/page.tsx`. Layout components live under `frontend/web/components`. Services for API calls are in `frontend/web/services` (e.g., `ai.service.ts`, `analytics.service.ts`).
- **API Gateway** (`services/api-gateway`): Express/Koa based gateway that proxies requests to downstream micro‑services, handling authentication, RBAC, and request logging.
- **Micro‑services** (`services/*`): Each domain (e.g., analytics, core, knowledge) runs as an independent service with its own DB schema. They expose REST endpoints consumed by the API gateway.
- **Docker Compose** (`docker-compose.yml`): Orchestrates all services locally for development and testing. Use `docker compose up` to spin up the full stack.
- **Database**: PostgreSQL containers defined in Docker Compose; schema migrations are managed per service (see each service's `migrations` folder).

## Development Tips
- When adding a new feature, start by updating the relevant service API, then adjust the gateway routes, and finally implement UI components.
- Keep UI and service code in sync: UI expects the shape defined in `services/*/src/types`.
- Run `pnpm test` frequently; tests are colocated with their modules.
- Use the Docker Compose environment for integration tests to ensure end‑to‑end behavior.

## Important Project Files
- `README.md`: top‑level project overview.
- `docker-compose.yml`: defines all containers.
- `.cursor/rules/` and `.github/copilot-instructions.md`: contain AI assistance policies—review them for any tooling constraints.

## AI Assistance Rules
- Follow the guidance in `.cursor/rules/` for safe code generation.
- Copilot instructions in `.github/copilot-instructions.md` outline preferred patterns and naming conventions.

## Context Guidance (Where to Find Context)
- **`contexts/architecture/`** – Contains system overview and high‑level architectural patterns.
- **`contexts/service-boundaries/`** – Documents API contracts, event definitions, and microservice responsibility ownership.
- **`contexts/database/`** – Holds full schemas, index strategies, queries, and specific table structures (analytics, core, knowledge, etc.).
- **`contexts/authorization/`** – Describes the RBAC matrix and dual‑strategy security logic.
- **`contexts/development/`** – Outlines extraction plans and development workflows.

**Rule:** Whenever an AI agent is asked to implement a feature, modify a database interaction, or touch service boundaries, it **MUST** first read the relevant markdown files in the `contexts/` folder to ensure alignment with the project's architecture.

## Living Documentation Rule
- When the AI implements a new REST endpoint, changes a database schema, modifies an RBAC role, or shifts service responsibilities, it **MUST** update the corresponding documentation files in the `contexts/` directory.
- The AI should briefly summarize which documentation files were updated in its response to the user.
- If the existing context is outdated or missing, the AI should proactively propose an update to the relevant `.md` file in `contexts/`.
- Follow the guidance in `.cursor/rules/` for safe code generation.
- Copilot instructions in `.github/copilot-instructions.md` outline preferred patterns and naming conventions.
---
*Generated for Claude Code to streamline future interactions.*