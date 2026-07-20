import 'dotenv/config';

import { z } from 'zod';

const environmentBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_HOST: z.string().default('0.0.0.0'),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  DEVICE_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().max(900).default(300),
  REQUIRE_TLS: environmentBoolean.default(false)
});

export type ServerConfig = z.infer<typeof environmentSchema>;

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return environmentSchema.parse({
    ...environment,
    // Render and Railway provide PORT. A deliberate BACKEND_PORT still wins.
    BACKEND_PORT: environment.BACKEND_PORT ?? environment.PORT
  });
}
