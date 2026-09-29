# AppPort GitHub DSL audit

This audit compares `@appport/github@1.0.1` with the canonical AppPort Services DSL and AppPort application manifest model.

| Concern | Established AppPort pattern | GitHub alignment |
| --- | --- | --- |
| Consumer declaration | `use webhooks`; configurable capabilities use `use capability { ... }` | `use github` or `use github { repositories = true }` |
| Capability identity | Semantic dotted operations in `AppPort/1` manifests | Existing `github.repository.read`, `github.pull_request.merge`, and related normalized operations |
| Transport | Hidden behind capability implementation | Octokit and REST routes remain internal and absent from package exports and DSL |
| Authentication | Identity/authorization and credential resolution are separate boundaries | Public mode uses no credential; authenticated modes use AppPort `SecretReference`; AuthBoundry authorizes operations |
| Persistence | `appport.toml` declares intent; sibling FlowSpec owns durable state | `feltdb.flow` remains canonical for connections, installations, repository metadata, webhook delivery, operations, and evidence |
| Contract | Provider publishes an implementation-free `AppPort/1` manifest | `githubAppPortManifest` is derived from canonical FlowSpec operation names |
| Runtime | AppPort contract selects a provider; provider owns implementation | `createGitHubIntegration()` supplies normalized semantic operation groups |
| Consumer coupling | Consumers depend on capabilities, not provider SDKs | Public declarations contain no Octokit or GitHub REST types; Factory and Compute are not dependencies |

## Operation groups retained

- `organizations`: organization reads.
- `repositories`: repository, branch, and commit reads plus the implemented branch creation operation.
- `webhooks`: verified inbound GitHub events and durable delivery records.
- `pull_requests`: read, create, update, comment, review, and merge.
- `issues`: read, create, update, and comment.

No `contents` group is declared because this package does not implement a contents operation. The DSL does not imply a complete GitHub SDK.

## Authentication and credentials

`authMechanism: 'public'` distinguishes public repository access and requires no credential reference. `github_app`, `oauth_token`, and `personal_access_token` connections require an AppPort Services `SecretReference`. The DSL never accepts token, secret, private-key, OAuth, database, or transport fields.

## Persistence

The package continues to use only FeltDB through `feltdb.flow`. The DSL introduces no cache, database, global mutable state, or package-local persistence. Connection state stores credential references rather than values.

## Compute boundary

The contract-level flow is:

```text
App
  → use github { repositories = true }
  → github.repository.read
  → { owner, repository, ref, commit, source }
  → provider-neutral Compute Git source
  → Workspace
```

The GitHub provider resolves GitHub semantics. Compute consumes a generic Git source shape; it does not import this package and GitHub is not a special Compute source type.
