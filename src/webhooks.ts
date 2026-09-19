import { createHmac, timingSafeEqual } from 'node:crypto';

export const supportedWebhookEvents = new Set([
  'push',
  'pull_request',
  'issues',
  'issue_comment',
  'installation',
  'installation_repositories',
]);

export function signGitHubWebhook(payload: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyGitHubWebhookSignature(payload: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature) {
    return false;
  }

  const expected = signGitHubWebhook(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function normalizeGitHubWebhookEvent(headers: Record<string, string | undefined>, payload: Record<string, unknown>): Record<string, unknown> {
  const repository = payload.repository as { full_name?: string } | undefined;
  const installation = payload.installation as { id?: number } | undefined;
  return {
    deliveryId: headers['x-github-delivery'] ?? '',
    eventName: headers['x-github-event'] ?? '',
    action: typeof payload.action === 'string' ? payload.action : undefined,
    repositoryFullName: repository?.full_name,
    installationId: installation?.id,
  };
}
