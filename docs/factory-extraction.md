# Factory extraction audit

## Repositories and files inspected

- `rkendel1/factory/package.json`
- `rkendel1/factory/.flow`
- `rkendel1/factory/src/github.ts`
- `rkendel1/factory/tests/*`

## 1. GitHub-specific logic that belongs in this repository

Generic GitHub boundary behavior belongs here:

- normalized GitHub capability contract
- GitHub connection metadata and credential references
- GitHub repository, branch, commit, issue, and pull-request operations
- GitHub webhook verification and durable webhook ingestion
- durable GitHub operation and evidence records
- AppPort-native GitHub UI discovery

## 2. Factory-specific execution logic that must remain in Factory

Factory remains responsible for:

- execution-run orchestration
- execution contracts and run evidence formatting
- PAX/native execution semantics
- Factory-specific `.flow` collections and capabilities

## 3. Existing API behavior that must remain compatible

Factory already depends on the platform stack (`@appport/sdk`, `@appport/services`, `@authboundry/core`, `@feltdb/core`, `@appport/appboundry`). The GitHub integration must preserve that dependency direction so Factory consumes a reusable GitHub boundary instead of owning one.

## 4. Existing GitHub evidence/provenance behavior

The current Factory repository contains only a small `src/github.ts` formatter that renders Factory execution evidence into GitHub-oriented text. There is no broad GitHub durable state model or GitHub webhook subsystem there today.

## 5. Existing GitHub authentication/configuration behavior

No concrete GitHub authentication or GitHub configuration subsystem was discovered in the current Factory repository. This repository therefore establishes the reusable connection and credential-reference boundary without importing Factory source.

## 6. Existing webhook behavior, if any

No GitHub webhook endpoint or webhook persistence layer was discovered in the current Factory repository during this audit.

## 7. Migration steps

1. Keep Factory’s execution semantics unchanged.
2. Move generic GitHub machine API calls to this repository.
3. Replace any future Factory-owned GitHub credential or webhook logic with this repository’s boundary.
4. Keep Factory consuming AuthBoundry, FeltDB, AppPort Services, AppBoundry, and PAX through their existing responsibilities.
5. Avoid a duplicate Factory-side GitHub subsystem.
