import { describe, expect, it } from 'vitest';

import { loadServerConfig } from '../src/config.js';

describe('production configuration', () => {
  it('uses provider PORT when BACKEND_PORT is not set', () => {
    expect(
      loadServerConfig({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL: 'postgresql://focuslog:password@postgres:5432/focuslog',
        REQUIRE_TLS: 'true'
      }).BACKEND_PORT
    ).toBe(8080);
  });

  it('parses production boolean environment strings explicitly', () => {
    expect(
      loadServerConfig({
        DATABASE_URL: 'postgresql://focuslog:password@postgres:5432/focuslog',
        REQUIRE_TLS: 'false'
      }).REQUIRE_TLS
    ).toBe(false);
  });
});
