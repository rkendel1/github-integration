# Platform integration

This repository is the canonical GitHub boundary for platform consumers. It owns the normalized GitHub contract, machine API, UI discovery surface, webhook verification, operation correlation, and durable evidence. It does **not** replace platform authority, credential, runtime, or durable-state boundaries.

## Discovered published packages

| Product | Published package used here | Version | Why it is consumed |
| --- | --- | --- | --- |
| FeltDB | `@feltdb/core` | `0.11.4` | Durable integration state, webhook records, operation records, evidence |
| AuthBoundry | `@authboundry/core` | `1.15.1` | Canonical authority projection and authorization checks |
| AppPort protocol | `@appport/sdk` | `1.1.18` | Actual published AppPort protocol/contract package discovered during implementation |
| AppPort Services | `@appport/services` | `0.4.0` | Credential/configuration reference types and service-boundary contract |
| AppBoundry | `@appport/appboundry` | `1.0.10` | Runtime-boundary contract metadata |

`@appport/core` was requested in the issue, but no public npm package was published under that exact name at implementation time. The current published AppPort contract package is `@appport/sdk`, so this repository documents and consumes that package instead of creating a fake compatibility shim.

## Ownership matrix

| System | Role | What GitHub Integration consumes |
| --- | --- | --- |
| AppPort | protocol | Capability metadata, normalized schemas, product-neutral machine contract |
| AppPort Services | configuration + credentials + services | Credential references, configuration requirements, externalized secret boundary |
| AuthBoundry | authority | Canonical principal, tenant, authorization decision |
| AppBoundry | runtime boundary | Runtime-boundary package contract metadata |
| FeltDB | durable state | Connection metadata, installations, repositories, operations, webhook records, evidence |
| PAX | project/tooling boundary | Not reimplemented here; documented as an external repository/tooling boundary |
| Attn | desktop product | Consumer of `/v1/ui`; not a dependency |
| Factory | execution product | First consumer of the normalized GitHub contract; not a dependency |

## Composition rules

- GitHub credentials remain outside ordinary state. This repository stores only credential references and connection metadata.
- AuthBoundry remains authoritative for identity, tenancy, and authorization. Caller-supplied identity hints are ignored.
- FeltDB remains the only durable state boundary used by this repository.
- AppPort capability metadata remains product-neutral. The public contract exposes normalized GitHub operations rather than GitHub SDK types.
- AppBoundry remains the runtime boundary; this repository only consumes its package contract metadata.
- PAX remains the repository/project/tooling boundary for local repository execution. This repository does not embed arbitrary shell-based repository tooling.

## Configuration contract

The integration declares configuration requirements in `.flow` and `/v1/ui` metadata:

- GitHub connection metadata
- GitHub credential reference
- Optional GitHub App installation metadata
- Webhook secret reference

Secret values are not stored in `.flow`, FeltDB records, evidence, URLs, logs, or UI discovery metadata.

## Consumer model

- **Factory** consumes the normalized GitHub contract and should stop owning generic GitHub boundary code.
- **Attn** discovers the UI surface at `GET /v1/ui` and composes it without an Attn-specific adapter.
- **Future hosts** can compose the same machine-readable capability and UI metadata without hard-coded product checks.
