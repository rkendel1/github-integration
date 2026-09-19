import type { AuthProjection } from '@authboundry/core';
import type { AuthorityBoundary, CanonicalInvocationContext, GitHubCapabilityName, InvocationInput } from './types.js';

export class AuthorizationRequiredError extends Error {
  constructor(capability: string) {
    super(`Authorization required for ${capability}`);
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authenticated principal and tenant are required.');
  }
}

export function createStaticAuthority(auth: AuthProjection): AuthorityBoundary {
  return {
    async session() {
      return auth;
    },
    async authorize(capability) {
      return auth.capabilities.includes(capability);
    },
  };
}

export async function createCanonicalInvocationContext(
  authority: AuthorityBoundary,
  input: InvocationInput,
  capability: GitHubCapabilityName,
): Promise<CanonicalInvocationContext> {
  const auth = await authority.session();
  const principalId = auth.principal?.id;
  const tenantId = auth.tenant?.id;

  if (!auth.authenticated || !principalId || !tenantId) {
    throw new AuthenticationRequiredError();
  }

  const authorized = await authority.authorize(capability);
  if (!authorized) {
    throw new AuthorizationRequiredError(capability);
  }

  return {
    applicationId: input.applicationId,
    principalId,
    tenantId,
    capability,
    auth,
  };
}
