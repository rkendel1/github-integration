import { createServer } from 'node:http';
import { createGitHubIntegration } from './integration.js';

const integration = createGitHubIntegration();

export const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    response.writeHead(400).end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === 'GET' && request.url === '/v1/ui') {
    const body = await integration.ui('github.integration');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
    return;
  }

  if (request.method === 'POST' && request.url.startsWith('/v1/webhooks/github')) {
    const url = new URL(request.url, 'http://127.0.0.1');
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
    const body = await integration.handleWebhook(connectionId, rawBody, headers);
    response.writeHead(body.signatureValid ? 202 : 401, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`github-integration listening on ${port}`);
  });
}
