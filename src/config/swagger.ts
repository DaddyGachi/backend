import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

/**
 * Swagger/OpenAPI Configuration for Dorisio API
 */
export const swaggerConfig = {
  swagger: {
    info: {
      title: 'Dorisio API',
      description: 'Payment orchestration and creator tipping platform on Stellar',
      version: '0.1.0',
      contact: {
        name: 'Dorisio Support',
        url: 'https://dorisio.com',
        email: 'support@dorisio.com',
      },
      license: {
        name: 'MIT',
      },
    },
    host: process.env.API_HOST || 'localhost:3000',
    schemes: [process.env.NODE_ENV === 'production' ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      bearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Bearer token for API authentication',
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and wallet operations',
      },
      {
        name: 'Payments',
        description: 'Payment and tip creation',
      },
      {
        name: 'Users',
        description: 'User profile and information',
      },
      {
        name: 'Creators',
        description: 'Creator profile and payout management',
      },
      {
        name: 'Health',
        description: 'System health and status',
      },
    ],
  },
  uiConfig: {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    } as FastifySwaggerUiOptions,
  },
};
