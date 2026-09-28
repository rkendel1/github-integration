# GitHub Integration

GitHub Integration is the standalone, AppPort-native GitHub product boundary for the platform ecosystem.

## Ownership model

- **GitHub Integration** owns normalized GitHub semantics, machine API, `AppPort/ui/1` discovery, webhook verification, and durable GitHub evidence.
- **AppPort** owns the protocol and capability contract.
- **AppPort Services** owns configuration and credentials.
- **AuthBoundry** owns identity, tenant, and authorization.
- **FeltDB** owns durable integration state and evidence storage.
- **AppBoundry** owns the application/runtime boundary where runtime packaging is required.
- **PAX** owns local repository and tooling execution.
- **Factory**, **Attn**, and **PNA** are consumers.

This repository is **not** a generic GitHub SDK, **not** a new portal, and **not** a Factory subsystem.

## Platform dependencies

Pinned platform dependencies:

- `@feltdb/core@0.11.4`
- `@authboundry/core@1.15.1`
- `@appport/sdk@1.1.19`
- `@appport/services@0.4.2`
- `@appport/appboundry@1.1.0`

See `docs/dependency-report.json` for the machine-readable dependency audit.

## Installation

```bash
npm install
npm run build
npm test
npm run package:check
```

The installable package is `@appport/github@1.0.1` and supports Node.js 22 or newer. Only the package root is public:

```ts
import { createGitHubIntegration } from '@appport/github';

const github = createGitHubIntegration({ authority, felt, configuration });
```

See [`docs/consumer.md`](docs/consumer.md) for the complete consumer contract and [`docs/package.md`](docs/package.md) for artifact contents, publication status, and the npm migration path.

## Configuration and credentials

GitHub connection metadata is durable. Credential values are not.

Configuration requirements are declared in:

- `src/ui-contract.ts` (`AppPort/ui/1` composition/configuration contract, enforced by `validateUiManifest`)
- `GET /v1/ui`

Expected configuration includes:

- GitHub connection metadata
- GitHub installation/application metadata
- GitHub credential reference
- GitHub webhook secret reference

AppPort Services remains the configuration and credential boundary. Secret values are write-only and must not appear in state, logs, UI metadata, URLs, or evidence.

## Authentication and authorization

Mutations follow this path:

```text
authenticate
  ↓
resolve canonical AuthBoundry context
  ↓
authorize capability
  ↓
execute normalized GitHub operation
  ↓
persist durable evidence
  ↓
return normalized result
```

Caller-supplied principal, tenant, and authorization hints are ignored.

## feltdb.flow

`feltdb.flow` is real FlowSpec, verified against the pinned `@feltdb/core@0.11.4` grammar with `feltdb validate feltdb.flow` (see `tests/architecture.test.ts`). It declares:

- durable collections (`GitHubConnection`, `GitHubInstallation`, `GitHubRepository`, `GitHubWebhookEvent`, `GitHubOperation`, `GitHubEvidence`)
- GitHub capabilities, one `capability` block per normalized operation, each with `visibility public`

Product identity, configuration requirements, composition context, and `AppPort/ui/1` surfaces are **not** FlowSpec concepts (the real `@feltdb/core` grammar only recognizes `collection`, `capability`, `agent`, `workflow`, `trigger`, `schedule`, `policy`, and `module` blocks — confirmed by parsing `node_modules/@feltdb/core/dist/flowspec.js`). That metadata is declared in TypeScript instead (`src/ui-contract.ts`, `src/platform.ts`), which is the actual AppPort-native surface for it, and is not duplicated in `feltdb.flow`.

`feltdb.flow` is the canonical durable-state and capability declaration, not an authorization engine.
Packaged consumers obtain the same file through `await github.flow()`; there is no second host or TypeScript capability declaration.

## API

HTTP endpoints:

- `GET /health`
- `GET /v1/ui`
- `POST /v1/github/webhooks`

The public TypeScript API exposes normalized product-owned types and operation groups such as:

- `github.organizations.list/get`
- `github.repositories.list/get`
- `github.branches.list/get/create`
- `github.commits.list/get`
- `github.issues.list/get/create/update/comment`
- `github.pullRequests.list/get/create/update/comment/review/merge`

GitHub SDK types remain internal implementation details.

## Webhooks

`github.webhooks.handle(...)` and `POST /v1/github/webhooks` verify GitHub webhook signatures, normalize supported events, and persist durable webhook records in FeltDB for correlation and idempotency.

Supported initial event families:

- `push`
- `pull_request`
- `issues`
- `issue_comment`
- `installation`
- `installation_repositories`

## Evidence

Every mutating operation writes durable evidence containing the canonical platform context and GitHub resource reference. Credential material is never stored in evidence.

## UI contribution

`GET /v1/ui` returns an `AppPort/ui/1` contribution with:

- product identity
- navigation entries
- same-application routes
- composition context requirements
- capability-linked actions
- configuration status

The response is capability-filtered. The UI never grants capability authority.

## Composition

The GitHub UI surface is designed to compose with other AppPort products without product-specific host code.

## Factory integration

See `docs/factory-extraction.md` for the extraction audit and migration direction.

## Security

- no second database
- no second authorization model
- no second secret store
- no GitHub SDK types in the public API barrel
- no credential persistence in ordinary state or evidence
- all mutations require AuthBoundry authorization and write durable evidence

## Development and testing

```bash
npm run build
npm run dependency-report
npm test
```

Focused tests cover architecture conformance, webhook verification, authorization boundaries, UI validation, capability filtering, dependency boundaries, and durable state behavior.
