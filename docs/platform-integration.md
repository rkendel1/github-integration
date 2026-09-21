# Platform integration

This repository is the canonical GitHub boundary for the AppPort product ecosystem. It owns GitHub-facing semantics, the normalized machine API, the AppPort-native `AppPort/ui/1` contribution, webhook verification, durable operation records, and durable evidence. It does **not** replace AppPort, AuthBoundry, FeltDB, AppPort Services, AppBoundry, or PAX.

## Publication-gap rule

Canonical repositories are architecturally authoritative. npm is the distribution mechanism. When the platform source moves ahead of npm publication, the GitHub Integration must preserve the existing architecture and use the smallest repository-native dependency mechanism available instead of copying code or inventing replacement packages.

## Dependency audit

| Platform | Canonical source | npm status | GitHub Integration usage |
| --- | --- | --- | --- |
| AppPort | `git+https://github.com/rkendel1/appport.git` (from npm metadata; repository not directly accessible from this session) | `@appport/sdk@1.1.19` published | protocol/UI contract |
| AppPort Services | `https://github.com/rkendel1/appport-services` | `@appport/services@0.4.1` published | configuration/credentials |
| AuthBoundry | `git+https://github.com/rkendel1/authboundry.git` (from npm metadata; repository not directly accessible from this session) | `@authboundry/core@1.15.1` published | identity/authorization |
| FeltDB | `git+https://github.com/rkendel1/feltdb.git` (from npm metadata; repository not directly accessible from this session) | `@feltdb/core@0.11.4` published | durable state |
| AppBoundry | `git+https://github.com/rkendel1/appport.git` (from npm metadata; repository not directly accessible from this session) | `@appport/appboundry@1.1.0` published | runtime boundary |
| PAX | `https://github.com/rkendel1/pax` | `pax@0.2.1` published, but kept external to this repository | project/tooling boundary |
| Factory | `https://github.com/rkendel1/factory` | consumer, not a runtime dependency | integration consumer |
| Attn | no public repository/package discoverable from this session | consumer/composition host, no package installed | UI composition host |
| PNA | `https://github.com/rkendel1/pna` | future consumer, not a runtime dependency | future consumer |

`@appport/core` is now published and arrives through the current SDK dependency graph. This integration directly consumes `@appport/sdk` because its schema helpers are the API used here; it does not add a redundant direct core dependency or invent a compatibility shim.

No separate `@appport/ui` npm package was discoverable. `AppPort/ui/1` is implemented here as a protocol contract, not as a package dependency.

## Package/publication state notes

See `docs/dependency-report.json` for the machine-readable package/publication report. It records:

- package
- version
- published yes/no
- canonical source
- repository version when discoverable
- required API
- temporary integration mechanism

Development remains possible during publication transitions. Release checks fail only when `RELEASE_ARTIFACT=true` and a required published package is missing.

## Ownership model

- **AppPort** owns the product-native capability contract.
- **AppPort Services** owns configuration, secrets, API keys, webhooks, and jobs.
- **AuthBoundry** owns identity, tenant, and authorization.
- **FeltDB** owns durable integration state and evidence.
- **AppBoundry** owns the application/runtime boundary.
- **PAX** owns repository/project/tooling execution.
- **GitHub Integration** owns normalized GitHub semantics.
- **Factory, Attn, and PNA** consume the integration.

## Dependency direction

```text
GitHub Integration
       │
       ├── @authboundry/core
       ├── @feltdb/core
       ├── @appport/sdk
       ├── @appport/services
       └── @appport/appboundry

Factory ──► GitHub Integration
Attn ─────► GitHub Integration
PNA ──────► GitHub Integration
```

This repository does not depend on Factory, Attn, or PNA.

## Temporary integration mechanism

The current repository uses published packages for its runtime dependencies. If a required package enters a publication gap later, the temporary mechanism must be a repository-native source dependency (workspace/local package/reference) that preserves the same product architecture. The integration must not respond by copying platform code or implementing a replacement boundary locally.

## Configuration and credential boundary

`.flow` and `GET /v1/ui` declare configuration requirements for:

- GitHub connection metadata
- GitHub installation/application metadata
- GitHub credential references
- GitHub webhook secret references

Raw secret values are not stored in `.flow`, FeltDB records, evidence, URLs, logs, or UI metadata. The durable state keeps only credential references and connection metadata.

## AppPort/ui/1 relationship

The UI contribution uses `AppPort/ui/1` semantics:

- product identity
- same-application routes
- navigation entries
- capability-linked actions
- composition context: identity, tenant, application, environment, capabilities

Hosts compose this surface without product-specific code.

## PAX relationship

GitHub Integration owns remote GitHub state and GitHub mutations. PAX remains the read-only/delegated project-tooling boundary for local repository and build/test/tool operations. This repository does not embed repository-local shell execution.
