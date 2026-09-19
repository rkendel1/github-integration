import { APPBOUNDRY_PACKAGE_CONTRACT } from '@appport/appboundry';
import platformData from './platform-data.json' with { type: 'json' };

export const discoveredPlatformPackages = platformData.discoveredPlatformPackages as Array<{
  product: string;
  packageName: string;
  version: string;
  reason: string;
  authorityOwner: string;
}>;

export const platformAudit = platformData.platformAudit as Array<{
  platform: string;
  canonicalSource: string;
  packageName: string;
  repositoryVersion: string;
  publishedVersion: string;
  published: boolean;
  requiredApi: string;
  temporaryIntegrationMechanism: string;
}>;

export const requiredConfiguration = platformData.requiredConfiguration as Array<{
  id: string;
  kind: 'connection' | 'credential_reference' | 'webhook';
  secret: false;
}>;

export const appBoundryContract = APPBOUNDRY_PACKAGE_CONTRACT;
