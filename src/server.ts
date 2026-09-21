import { createServer, type IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createAuthBoundry } from '@authboundry/core';
import { createGitHubIntegration, InvalidWebhookPayloadError } from './integration.js';

const integration = createGitHubIntegration();

function authorityFromRequest(request: IncomingMessage) {
  return createAuthBoundry({
    baseUrl: process.env.AUTHBOUNDRY_URL,
    fetch: (input, init = {}) => {
      const requestHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        requestHeaders[key] = Array.isArray(value) ? value.join(',') : (value ?? '');
      }
      return fetch(input, {
        ...init,
        headers: {
          ...requestHeaders,
          ...((init.headers ?? {}) as Record<string, string>),
        },
      });
    },
  });
}

export const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    response.writeHead(400).end();
    return;
  }

  const url = new URL(request.url, 'http://127.0.0.1');

  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/ui') {
    const body = await integration.ui('github.integration', authorityFromRequest(request));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/github/webhooks') {
    const connectionId = url.searchParams.get('connectionId');
    if (!connectionId) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'connectionId is required' }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
    try {
      const body = await integration.webhooks.handle(connectionId, rawBody, headers);
      response.writeHead(body.signatureValid ? 202 : 401, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
      return;
    } catch (error) {
      if (error instanceof InvalidWebhookPayloadError) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'invalid_webhook_payload' }));
        return;
      }
      throw error;
    }
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entrypoint && import.meta.url === entrypoint) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`github-integration listening on ${port}`);
  });
}
