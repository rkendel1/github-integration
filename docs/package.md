# Package and publication

The canonical package identity is `@appport/github@1.0.1`. The canonical repository is the source of truth for development; a published npm package is an immutable registry artifact; an installed npm package is a particular resolved copy in a consumer. These are separate states and must not be treated as interchangeable.

## Entry point and artifact

The only supported entry point is the package root:

```ts
import { createGitHubIntegration } from '@appport/github';
```

The root exports the constructor, public errors, normalized GitHub contracts, DSL parser, derived `AppPort/1` manifest, operation inputs, connection and webhook records, and `AppPort/ui/1` contribution types. Source paths and implementation subpaths are not exports. The artifact contains compiled runtime files, declarations, this documentation, the DSL audit, the package README, and the authoritative `feltdb.flow`; it excludes repository source, tests, fixtures, scripts, and development configuration.

## Dependencies

Runtime dependencies are `@appport/appboundry`, `@appport/sdk`, `@appport/services`, `@authboundry/core`, `@feltdb/core`, and `@octokit/rest`. The GitHub SDK is private to the transport and is not a consumer contract. Development dependencies are TypeScript and Node.js declarations. Factory, Attn, PNA, and PAX are not dependencies.

All required runtime packages and `@appport/github@1.0.1` are published on npm at the exact versions in `package.json`. Development uses a normal repository checkout followed by `npm install`; release candidates can also be inspected as tarballs from `npm run package`. There is no hidden workspace alias or copied platform source.

## Publication status and migration

`@appport/github@1.0.1` is published on npm. Consumers install the exact registry version with:

```json
{ "dependencies": { "@appport/github": "1.0.1" } }
```

If a platform package later has a publication gap, use its smallest supported repository/workspace reference without changing this public API, copying its source, inventing a version, or adding a compatibility implementation.

## Reproducibility

`npm run package` builds through npm's standard packing lifecycle and writes the tarball to `artifacts/`. `npm run package:check` packs the same commit into a temporary directory, validates contents and exports, installs it in an isolated consumer, runs a public import and normalized operation, verifies `feltdb.flow` with `feltdb validate`, and type-checks public contracts.

## Consumer independence

Consumers use the semantic AppPort contract and must not import Octokit, own GitHub credentials or webhook verification, persist a parallel GitHub model, or duplicate GitHub API types. Compute remains independent: its Git source primitive accepts normalized source data and does not depend on `@appport/github`.
