# Consumer contract

## Construction

```ts
import { createGitHubIntegration } from '@rkendel1/github-integration';

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

Authentication or authorization failure is reported before provider transport with `AuthenticationRequiredError` or `AuthorizationRequiredError`. Unknown connections and unresolved credentials are ordinary `Error` failures. Malformed or unsupported webhook input throws `InvalidWebhookPayloadError`. Provider failures are not exposed as Octokit types in the public contract.

## Webhooks

Pass the untouched request body and normalized string headers to `github.webhooks.handle(connectionId, rawBody, headers)`. The integration owns GitHub HMAC verification, payload normalization, supported-event validation, durable delivery records, and idempotency.

## UI and `.flow`

`await github.ui(applicationId)` returns the capability-filtered `AppPort/ui/1` contribution. It contains no authorization grants, secret values, or host-owned durable state. `await github.flow()` returns the packaged canonical `.flow` text; hosts must not create a separate capability registry from it.

## Provider isolation and durability

Consumers import only the package root and integration-owned types. They must not depend on Octokit, GitHub SDK request/response/authentication types, package source paths, or GitHub transport internals. GitHub connections, normalized repository records, operations, evidence, and webhook deliveries remain integration-owned durable state in FeltDB.
