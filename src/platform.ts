import { APPBOUNDRY_PACKAGE_CONTRACT } from '@appport/appboundry';

export const discoveredPlatformPackages = [
  { product: 'FeltDB', packageName: '@feltdb/core', version: '0.11.4', reason: 'durable integration state' },
  { product: 'AuthBoundry', packageName: '@authboundry/core', version: '1.15.1', reason: 'authority and authorization' },
  { product: 'AppPort protocol', packageName: '@appport/sdk', version: '1.1.18', reason: 'published AppPort contract package' },
  { product: 'AppPort Services', packageName: '@appport/services', version: '0.4.0', reason: 'configuration and credential reference boundary' },
  { product: 'AppBoundry', packageName: '@appport/appboundry', version: '1.0.10', reason: 'runtime boundary contract' },
] as const;

export const appBoundryContract = APPBOUNDRY_PACKAGE_CONTRACT;
export const requiredConfiguration = [
  { id: 'github.connection', kind: 'connection', secret: false },
  { id: 'github.credential_reference', kind: 'credential_reference', secret: false },
  { id: 'github.webhook_secret_reference', kind: 'webhook', secret: false },
] as const;
