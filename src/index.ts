export {
  createGitHubIntegration,
  GitHubCapabilityError,
  InvalidWebhookPayloadError,
} from './integration.js';
export {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
} from './auth.js';
export {
  GitHubDslError,
  githubCapabilityGroups,
  parseGitHubCapabilityDeclaration,
} from './dsl.js';
export { githubAppPortManifest } from './capabilities.js';
export type { GitHubCapabilityDeclaration, GitHubCapabilityGroup } from './dsl.js';
export type {
  GitHubIntegration,
  GitHubIntegrationConfiguration,
  GitHubIntegrationOptions,
  GitHubCapabilityErrorCode,
} from './integration.js';
export type * from './types.js';
