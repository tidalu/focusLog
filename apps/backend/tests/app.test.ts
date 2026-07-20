import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({
    NODE_ENV: 'test',
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: 3000,
    DATABASE_URL: 'postgresql://focuslog:focuslog@localhost:5432/focuslog?schema=public',
    LOG_LEVEL: 'silent',
    API_RATE_LIMIT_MAX: 120,
    DEVICE_AUTH_MAX_AGE_SECONDS: 300,
    REQUIRE_TLS: false
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
}, 60_000);

describe('backend foundation', () => {
  it('serves the health endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'focuslog-backend' });
  });

  it('serves OpenAPI documentation', async () => {
    const response = await app.inject({ method: 'GET', url: '/documentation/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ openapi: expect.any(String) });
  });

  it('returns a structured validation error before accessing persistence', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/bootstrap',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('keeps local health probes available while requiring TLS for the API', async () => {
    const tlsApp = await buildApp({
      NODE_ENV: 'test',
      BACKEND_HOST: '127.0.0.1',
      BACKEND_PORT: 3000,
      DATABASE_URL: 'postgresql://focuslog:focuslog@localhost:5432/focuslog?schema=public',
      LOG_LEVEL: 'silent',
      API_RATE_LIMIT_MAX: 120,
      DEVICE_AUTH_MAX_AGE_SECONDS: 300,
      REQUIRE_TLS: true
    });
    try {
      expect((await tlsApp.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
      expect(
        (
          await tlsApp.inject({
            method: 'POST',
            url: '/api/v1/devices/bootstrap',
            payload: {}
          })
        ).json()
      ).toMatchObject({ error: { code: 'TLS_REQUIRED' } });
    } finally {
      await tlsApp.close();
    }
  });
});
