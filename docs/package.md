# Package and publication

The canonical package identity is `@rkendel1/github-integration@1.0.1`. The canonical repository is the source of truth for development; a published npm package is an immutable registry artifact; an installed npm package is a particular resolved copy in a consumer. These are separate states and must not be treated as interchangeable.

## Entry point and artifact

The only supported entry point is the package root:

```ts
import { createGitHubIntegration } from '@rkendel1/github-integration';
```

The root exports the constructor, public errors, normalized GitHub contracts, operation inputs, connection and webhook records, and `AppPort/ui/1` contribution types. Source paths and implementation subpaths are not exports. The artifact contains compiled runtime files, declarations, this documentation, the package README, and the authoritative `.flow`; it excludes repository source, tests, fixtures, scripts, and development configuration.

## Dependencies

Runtime dependencies are `@appport/appboundry`, `@appport/sdk`, `@appport/services`, `@authboundry/core`, `@feltdb/core`, and `@octokit/rest`. The GitHub SDK is private to the transport and is not a consumer contract. Development dependencies are TypeScript and Node.js declarations. Factory, Attn, PNA, and PAX are not dependencies.

All required runtime packages are currently published on npm at the exact versions in `package.json`. Therefore the current local mechanism is a normal repository checkout followed by `npm install`; consumers can use a tarball from `npm run package` until this package itself is published. There is no hidden workspace alias or copied platform source.

## Publication status and migration

As of this repository version, `@rkendel1/github-integration@1.0.1` is packaged and verified locally but publication is not asserted by the repository. Consumers should install the generated tarball or use the repository-native dependency mechanism agreed for development. After npm publication, migration should be only the dependency reference:

```json
{ "dependencies": { "@rkendel1/github-integration": "1.0.1" } }
```

If a platform package later has a publication gap, use its smallest supported repository/workspace reference without changing this public API, copying its source, inventing a version, or adding a compatibility implementation.

## Reproducibility

`npm run package` builds through npm's standard packing lifecycle and writes the tarball to `artifacts/`. `npm run package:check` packs the same commit into a temporary directory, validates contents and exports, installs it in an isolated consumer, runs a public import and normalized operation, verifies `.flow`, and type-checks public contracts.

## Intended Factory dependency

The next change belongs in Factory: `Factory -> @rkendel1/github-integration -> GitHub`. Factory consumes normalized operations and must not import Octokit, own GitHub credentials or webhook verification, persist a parallel GitHub model, or duplicate GitHub capability/API types.
