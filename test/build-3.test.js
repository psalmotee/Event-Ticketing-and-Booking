import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DomainError } from '../src/domain/errors.js';
import {
  assertTransition,
  BOOKING_STATES,
  canTransition,
} from '../src/domain/bookingStateMachine.js';
import { createApp } from '../src/http/app.js';
import { Router } from '../src/http/router.js';
import { startServer } from '../src/server.js';

test('booking state machine exposes all states and allows every specified move', () => {
  assert.deepEqual(BOOKING_STATES, ['pending', 'paid', 'cancelled', 'refunded', 'checked_in']);
  const allowed = [
    ['pending', 'paid'], ['pending', 'cancelled'],
    ['paid', 'checked_in'], ['paid', 'refunded'], ['paid', 'cancelled'],
  ];
  for (const [from, to] of allowed) {
    assert.equal(canTransition(from, to), true);
    assert.doesNotThrow(() => assertTransition(from, to));
  }
});

test('booking state machine rejects every illegal move', () => {
  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      const allowed = (from === 'pending' && ['paid', 'cancelled'].includes(to))
        || (from === 'paid' && ['checked_in', 'refunded', 'cancelled'].includes(to));
      assert.equal(canTransition(from, to), allowed, `${from} -> ${to}`);
      if (!allowed) {
        assert.throws(() => assertTransition(from, to), (error) => (
          error instanceof DomainError && error.code === 'INVALID_TRANSITION'
        ));
      }
    }
  }
  assert.equal(canTransition('unknown', 'paid'), false);
});

test('router matches methods and named parameters', () => {
  const router = new Router();
  const handler = () => {};
  router.add('GET', '/events/:eventId', handler);
  assert.deepEqual(router.match('GET', '/events/event-1'), {
    handler,
    params: { eventId: 'event-1' },
  });
  assert.equal(router.match('POST', '/events/event-1'), undefined);
});

test('real HTTP request to health returns JSON', async () => {
  const server = startServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const result = await new Promise((resolve, reject) => {
    const requestHandle = request({ port: address.port, path: '/health' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    requestHandle.on('error', reject);
    requestHandle.end();
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), { status: 'ok' });
});

test('app returns JSON errors and confines static files to public', async () => {
  const root = await mkdtemp(join(tmpdir(), 'event-ticketing-'));
  await writeFile(join(root, 'inside.txt'), 'inside');
  const app = createApp({ publicDir: root });
  const responseFor = () => ({
    headersSent: false,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body = '') { this.body = body; },
  });
  const apiResponse = responseFor();
  await app({ method: 'GET', url: '/api/missing', headers: {} }, apiResponse);
  assert.equal(apiResponse.status, 404);
  assert.deepEqual(JSON.parse(apiResponse.body), {
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });

  const badJsonResponse = responseFor();
  const badJsonRequest = {
    method: 'POST',
    url: '/api/bookings',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { yield Buffer.from('{bad'); },
  };
  await app(badJsonRequest, badJsonResponse);
  assert.equal(badJsonResponse.status, 400);
  assert.deepEqual(JSON.parse(badJsonResponse.body).error.code, 'BAD_JSON');

  const traversalResponse = responseFor();
  await app({
    method: 'GET',
    url: '/%2e%2e/%2e%2e/package.json',
    headers: {},
  }, traversalResponse);
  assert.equal(traversalResponse.status, 404);
  assert.equal(JSON.parse(traversalResponse.body).error.code, 'NOT_FOUND');
});