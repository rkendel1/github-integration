# Architecture audit

This repository enforces the following architectural checks in `tests/architecture.test.ts`:

- no second durable database dependency
- no second authorization system dependency
- no local secret store dependency
- no `factory`, `attn`, or `pna` runtime dependency
- no duplicated AppPort Services credential storage
- no duplicated AuthBoundry identity model
- no duplicated AppBoundry runtime boundary
- no duplicated PAX functionality
- no GitHub SDK types crossing the public API barrel
- canonical `.flow` exists
- UI metadata actions map to declared capabilities
- mutation capabilities require authorization
- mutation capabilities generate durable evidence
