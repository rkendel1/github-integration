# Architecture audit

This repository enforces architectural conformance in tests and validation code.

Checks include:

- no second durable database dependency
- no second authorization engine dependency
- no second secret store dependency
- no `factory`, `attn`, `pna`, or `pax` runtime dependency
- no duplicated AppPort Services credential store
- no duplicated AuthBoundry identity, tenant, or authorization model
- no duplicated AppBoundry runtime boundary
- no duplicated PAX project/tooling boundary
- no GitHub SDK types crossing the public API barrel
- canonical `.flow` exists
- `AppPort/ui/1` metadata validates
- UI actions map to declared capabilities
- UI discovery filters actions/surfaces by capabilities
- mutations require authorization
- mutations generate durable evidence
- webhook verification is durable and idempotent
- secret values are absent from ordinary connection state and evidence
