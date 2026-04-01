# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Poliwise is a multi-service repository with three main areas:
- `frontend/web`: Next.js 16 App Router frontend.
- `services/api-gateway`: NestJS API gateway intended to be the single entry point for clients.
- `services/*-service`: Spring Boot 3 / Java 17 microservices, each owning its own data model.
- `docs/`: product and architecture notes that currently describe intended responsibilities and data boundaries better than the partially implemented code.

The repo is still scaffold-heavy in places. The docs define the target architecture, while several services currently contain entities/repositories/config but very little controller/service logic.

## Common commands

### Frontend (`frontend/web`)
- Install deps: `cd frontend/web && pnpm install`
- Start dev server: `cd frontend/web && pnpm dev`
- Build: `cd frontend/web && pnpm build`
- Start production server: `cd frontend/web && pnpm start`
- Lint: `cd frontend/web && pnpm lint`

### API gateway (`services/api-gateway`)
- Install deps: `cd services/api-gateway && pnpm install`
- Start in watch mode: `cd services/api-gateway && pnpm run start:dev`
- Start once: `cd services/api-gateway && pnpm run start`
- Build: `cd services/api-gateway && pnpm run build`
- Lint: `cd services/api-gateway && pnpm run lint`
- Run all tests: `cd services/api-gateway && pnpm test`
- Run a single Jest file: `cd services/api-gateway && pnpm test -- app.controller.spec.ts`
- Run tests matching a name: `cd services/api-gateway && pnpm test -- --testNamePattern="name"`
- Run e2e tests: `cd services/api-gateway && pnpm run test:e2e`

### Spring Boot services (`services/auth-service`, `feedback-service`, `knowledge-service`, `metadata-service`, `user-service`)
Use the Maven wrapper from the service directory.

- Run locally: `cd services/<service-name> && ./mvnw spring-boot:run`
- Build jar: `cd services/<service-name> && ./mvnw package`
- Run tests: `cd services/<service-name> && ./mvnw test`
- Run a single test class: `cd services/<service-name> && ./mvnw -Dtest=ClassName test`
- Run a single test method: `cd services/<service-name> && ./mvnw -Dtest=ClassName#methodName test`

There do not appear to be committed test sources yet in the Java services or API gateway, so expect test commands to be mostly for newly added tests.

## Architecture overview

### Frontend
- The frontend is a Next.js App Router app rooted at `frontend/web/app`.
- Current UI is minimal: `frontend/web/app/page.tsx` renders a reusable animated loading screen from `frontend/web/components/ui/loading/LoadingScreen.tsx`.
- Styling mixes global CSS in `frontend/web/app/globals.css` with component SCSS for the loading component.
- Current `layout.tsx` and metadata are still close to starter defaults, so treat the frontend as early-stage.

### API gateway
- `services/api-gateway` is a NestJS service with a very small starter module (`src/main.ts`, `src/app.module.ts`).
- According to `docs/func_per_services.md`, the intended gateway responsibilities are request entry, routing/proxying to downstream services, JWT validation, RBAC enforcement, tracing, logging, validation, CORS, and response normalization.
- The code does not yet implement most of that behavior, so when adding gateway features, align new code with the docs rather than assuming the current Nest scaffold is authoritative.

### Spring microservices
All Java services use the same broad pattern:
- Spring Boot 3 + Java 17.
- JPA entities and repositories per service.
- PostgreSQL driver included in every service.
- Spring Security, validation, OpenFeign, RabbitMQ, and actuator are standard dependencies across services.
- Package layout generally follows `config`, `controller`, `dto`, `entity`, `enums`, `exception`, `mapper`, `repository`, `service`.

Current service roles are best inferred from `docs/func_per_services.md`, `docs/db_per_services.md`, and the entities already committed:

- `auth-service`: authentication, JWT lifecycle, refresh tokens, login history, and RBAC-related user state. This is the most fleshed-out service in code today.
- `user-service`: user profile and department data. Docs say it should own employee/profile management and account-state workflows, but controllers are still mostly placeholders.
- `knowledge-service`: physical document lifecycle and processing pipeline. Current code defines `Document`, `DocumentVersion`, and `ProcessingJob`, matching the ETL/versioning role described in docs.
- `metadata-service`: document metadata, categories, tags, and access rules. Current entities split document metadata/access concerns away from raw document processing.
- `feedback-service`: analytics/feedback store. Current entities include feedback, usage stats, aggregates, audit logs, popular questions, document popularity, report exports, and unanswered questions.

### Intended domain boundaries
The docs describe strong database ownership per service:
- Auth/RBAC data in `poliwise_auth`
- User/profile data in `poliwise_user`
- Knowledge processing data in `poliwise_knowledge`
- Metadata/access-control data in `poliwise_metadata`
- Feedback/analytics data in `poliwise_analytics`

That separation is important when changing entities or APIs: prefer cross-service calls/events over sharing persistence concerns.

### Event-driven integration
`docs/func_per_services.md` describes RabbitMQ-based integration between services. Important planned events include:
- `User.status.changed`
- `User.revoked`
- `Document.uploaded`
- `Document.deleted`
- `Unanswered.question`

The dependencies for messaging are already present in the Java services even where consumers/producers are not yet implemented.

### RBAC model
`docs/allow_per_role.md` defines three roles: `User`, `Manager`, and `Admin`.
- User: AI Q&A and self-service profile features.
- Manager: user capabilities plus analytics/reporting visibility.
- Admin: management of accounts, document upload, metadata, and versioning.

Use this doc as the source of truth when implementing authorization checks unless the user asks to change the permissions model.

## Working guidance for this repo
- Check `docs/func_per_services.md`, `docs/db_per_services.md`, and `docs/allow_per_role.md` before making architectural changes; they currently contain key intended behavior that is not obvious from the code alone.
- Expect many files to be generated starter code or skeletal implementations. Verify whether behavior is actually implemented before extending it.
- Ignore `target/` outputs in Spring services and `node_modules/` under the frontend when navigating or searching.
- There is no existing `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` file in the repo at the time this document was created.