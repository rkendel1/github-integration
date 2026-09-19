# Factory extraction audit

## Factory state inspected

The current `rkendel1/factory` repository depends on:

- `@appport/appboundry@^1.0.10`
- `@appport/sdk@^1.1.18`
- `@appport/services@^0.4.0`
- `@authboundry/core@^1.15.1`
- `@feltdb/core@0.11.4`

Relevant inspected files:

- `package.json`
- `.flow`
- `src/github.ts`

## What Factory currently implements

Factory currently contains a very small GitHub-specific file: `src/github.ts`. That file formats Factory execution results for GitHub-oriented output strings; it does **not** implement GitHub authentication, webhook handling, repository normalization, issue/PR lifecycle, or GitHub durable state.

## Generic GitHub integration behavior

The following behavior is generic platform GitHub boundary logic and belongs in this repository:

- normalized GitHub capability contract
- GitHub connection metadata and credential references
- GitHub repository/issue/pull-request operations
- GitHub webhook verification and normalization
- durable GitHub operation/evidence records
- product-neutral UI discovery for GitHub capabilities

## Factory-specific behavior that remains in Factory

Factory should retain:

- execution-run orchestration
- execution contracts and evidence formatting for Factory runs
- Factory-specific `.flow` collections and capabilities
- PAX/native execution semantics owned by Factory

## Code that moves or is replaced

There is no large existing GitHub subsystem inside Factory to move today. Instead, this repository establishes the reusable GitHub boundary so Factory can consume it directly and eventually replace its small GitHub formatter with calls to the normalized GitHub contract when Factory needs repository, issue, or pull-request operations.

## Factory APIs expected to consume this integration

Factory should consume this repository for:

- repository lookup and normalization
- issue and pull-request creation/update/comment flows
- durable GitHub evidence for repository-facing mutations
- webhook-driven GitHub event ingestion where Factory needs GitHub-triggered workflows

## Behavior that must remain unchanged

- Factory keeps AuthBoundry as the authority boundary.
- Factory keeps FeltDB as the durable state boundary.
- Factory keeps AppBoundry/PAX execution semantics unchanged.
- Factory does not become the owner of GitHub credentials, GitHub SDK selection, or GitHub webhook processing.
