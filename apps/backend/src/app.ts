import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import type { ServerConfig } from './config.js';
import { ApiError } from './lib/errors.js';
import { registerV1Routes } from './routes/v1.js';
import { FocusLogWebSocketGateway } from './services/websocket-gateway.js';

export async function buildApp(
  config: ServerConfig,
  prisma = new PrismaClient()
): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: config.LOG_LEVEL }, trustProxy: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: true,
    max: config.API_RATE_LIMIT_MAX,
    timeWindow: '1 minute'
  });
  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: JSON.parse(
        readFileSync(
          new URL('../../../contracts/openapi/focuslog-v1.json', import.meta.url),
          'utf8'
        )
      )
    }
  });
  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list' }
  });

  app.addHook('onRequest', async (request) => {
    if (
      config.REQUIRE_TLS &&
      !request.url.startsWith('/health') &&
      request.protocol !== 'https' &&
      request.headers['x-forwarded-proto'] !== 'https'
    ) {
      throw new ApiError(400, 'TLS_REQUIRED', 'Encrypted transport is required.');
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const apiError =
      error instanceof ApiError
        ? error
        : error instanceof ZodError
          ? new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', error.flatten())
          : new ApiError(500, 'INTERNAL_ERROR', 'Unexpected server error.');
    request.log[apiError.statusCode >= 500 ? 'error' : 'warn'](
      { err: error, code: apiError.code },
      apiError.message
    );
    return reply.status(apiError.statusCode).send({
      error: { code: apiError.code, message: apiError.message, details: apiError.details }
    });
  });
  app.addHook('onClose', async () => prisma.$disconnect());

  app.get('/health', async () => ({ status: 'ok', service: 'focuslog-backend' }));
  app.get('/health/live', async () => ({ status: 'ok', service: 'focuslog-backend' }));
  app.get('/health/ready', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ready' };
  });
  const websocketGateway = new FocusLogWebSocketGateway(prisma, config);
  await websocketGateway.register(app);
  await app.register(registerV1Routes(prisma, config, websocketGateway), { prefix: '/api/v1' });
  return app;
}
import { readFileSync } from 'node:fs';
