import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Router } from './router.js';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

async function readJsonBody(request) {
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    return undefined;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Request body contains invalid JSON');
    error.code = 'BAD_JSON';
    throw error;
  }
}

function safeFilePath(publicRoot, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const root = resolve(publicRoot);
  const candidate = resolve(root, `.${decodedPath}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined;
  return candidate;
}

async function serveStatic(request, response, publicRoot, pathname) {
  const requestedPath = safeFilePath(publicRoot, pathname);
  if (!requestedPath) {
    sendError(response, 404, 'NOT_FOUND', 'Resource not found');
    return;
  }

  let filePath;
  let fileStats;
  try {
    const root = await realpath(publicRoot);
    filePath = await realpath(requestedPath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      sendError(response, 404, 'NOT_FOUND', 'Resource not found');
      return;
    }
    fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      filePath = resolve(filePath, 'index.html');
      filePath = await realpath(filePath);
      if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
        sendError(response, 404, 'NOT_FOUND', 'Resource not found');
        return;
      }
      fileStats = await stat(filePath);
    }
    if (!fileStats.isFile()) throw new Error('Not a file');
  } catch {
    sendError(response, 404, 'NOT_FOUND', 'Resource not found');
    return;
  }

  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'content-length': fileStats.size,
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
}

export function createApp({ publicDir = resolve('public'), router = new Router() } = {}) {
  router.get('/health', (_request, response) => {
    sendJson(response, 200, { status: 'ok' });
  });

  return async function app(request, response) {
    try {
      const body = await readJsonBody(request);
      const url = new URL(request.url, 'http://localhost');
      const match = router.match(request.method, url.pathname);
      if (match) {
        await match.handler(request, response, match.params, body);
        return;
      }

      if (url.pathname === '/health' && request.method !== 'GET') {
        sendError(response, 404, 'NOT_FOUND', 'Route not found');
        return;
      }
      if (url.pathname.startsWith('/api')) {
        sendError(response, 404, 'NOT_FOUND', 'Route not found');
        return;
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        await serveStatic(request, response, publicDir, url.pathname);
        return;
      }
      sendError(response, 404, 'NOT_FOUND', 'Route not found');
    } catch (error) {
      if (error?.code === 'BAD_JSON') {
        sendError(response, 400, 'BAD_JSON', error.message);
        return;
      }
      if (!response.headersSent) {
        sendError(response, 500, 'INTERNAL_ERROR', 'Internal server error');
      } else {
        response.destroy();
      }
    }
  };
}
