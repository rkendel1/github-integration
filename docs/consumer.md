# Consumer contract

## Construction

```ts
import { createGitHubIntegration } from '@appport/github';

const github = createGitHubIntegration({
  authority,
  felt: { namespace: 'github-integration', path: '/durable/data' },
  configuration: {
    resolveGitHubToken: async (connection, context) => secrets.resolve(connection.credentialReference, context),
    resolveWebhookSecret: async (connection) => secrets.resolve(connection.webhookSecretReference),
  },
});
```

`authority` is the AuthBoundry-compatible identity and capability boundary. `felt` is FeltDB configuration, not another database. `configuration` bridges AppPort Services credential references to write-only secret resolution. Environment variables `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` are fallback resolvers for standalone development.

## Connections, operations, and context

Persist connection metadata with `upsertConnection`; it stores credential references, never secret values. The normalized operation groups are `organizations`, `repositories`, `branches`, `commits`, `issues`, and `pullRequests`.

```ts
await github.pullRequests.merge(
  { connectionId, owner, repository, pullNumber, method: 'squash' },
  { applicationId },
);
```

The invocation supplies application context. Principal, tenant, authentication, and capability authority come from AuthBoundry; caller identity claims are not trusted. Mutations persist operation evidence in integration-owned FeltDB collections.

## Errors

Authentication or authorization failure is reported before provider transport with `AuthenticationRequiredError` or `AuthorizationRequiredError`. Source resolution reports `GitHubCapabilityError` with `INVALID_INPUT`, `REPOSITORY_NOT_FOUND`, `REF_NOT_FOUND`, `AUTHENTICATION_UNAVAILABLE`, or `PROVIDER_FAILURE`; provider messages and credentials are not copied into the public error or durable operation record. Malformed or unsupported webhook input throws `InvalidWebhookPayloadError`. Provider failures are not exposed as Octokit types in the public contract.

## Webhooks

Pass the untouched request body and normalized string headers to `github.webhooks.handle(connectionId, rawBody, headers)`. The integration owns GitHub HMAC verification, payload normalization, supported-event validation, durable delivery records, and idempotency.

## UI and `feltdb.flow`

`await github.ui(applicationId)` returns the capability-filtered `AppPort/ui/1` contribution. It contains no authorization grants, secret values, or host-owned durable state. `await github.flow()` returns the packaged canonical `feltdb.flow` text (real, `feltdb validate`-passing FlowSpec); hosts must not create a separate capability registry from it.

## Provider isolation and durability

Consumers import only the package root and integration-owned types. They must not depend on Octokit, GitHub SDK request/response/authentication types, package source paths, or GitHub transport internals. GitHub connections, normalized repository records, operations, evidence, and webhook deliveries remain integration-owned durable state in FeltDB.

## Capability declaration

Declare intent in `appport.toml`; do not put credentials or REST endpoints in the declaration:

```toml
use github {
  repositories = true
}
```

```ts
import { githubAppPortManifest, parseGitHubCapabilityDeclaration } from '@appport/github';

const declared = parseGitHubCapabilityDeclaration(appportToml);
const provided = githubAppPortManifest.provides;
```

The block form follows the established AppPort `use capability { ... }` syntax. A plain `use github` selects every implemented GitHub group. The DSL declares requirements; AuthBoundry still decides whether a principal may invoke each operation.

## Repository source boundary

`github.repositories.source(...)` resolves a repository and ref to a normalized immutable Git source descriptor:

```ts
const source = await github.repositories.source(
  { connectionId, owner: 'acme', repository: 'application', ref: 'main' },
  { applicationId: 'source-consumer' },
);
// { source: 'git', url, owner, repository, ref, commit }
```

The descriptor contains no provider discriminator or credential. A consumer can pass `source`, `url`, `owner`, `repository`, `ref`, and `commit` to a generic Git materializer without importing GitHub transport or authentication types. Authenticated source resolution remains behind this package and AppPort credential references.

The requested `ref` is preserved while `commit` records the immutable resolved SHA. When `ref` is omitted, resolution uses the repository's default branch. Resolution fails atomically: it never returns a partial source when the repository, ref, authentication, or provider request fails.
