# Changelog

All notable changes to the Dorisio Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-13

### Added

- **Payment Orchestration**
  - Tip creation and status tracking
  - Stellar payment transaction building and submission
  - Transaction history and confirmation tracking
  - Rate limiting: 10 tips per user per hour

- **Creator Management**
  - Creator profile and verification
  - Wallet management and payout processing
  - Analytics and revenue tracking

- **User Management**
  - User registration and authentication with JWT
  - Profile management
  - Settings management

- **API Documentation**
  - OpenAPI/Swagger integration at `/docs`
  - Full schema documentation for all endpoints
  - Security definitions and authentication examples

- **Deployment & Operations**
  - Enhanced `/health` endpoint with dependency checks
  - Database connectivity verification
  - Memory usage monitoring
  - Uptime tracking

- **Security**
  - Rate limiting middleware
  - JWT-based authentication
  - Wallet verification before payments
  - Error handling and validation

### Infrastructure

- Fastify framework with CORS support
- PostgreSQL via Prisma ORM
- Stellar SDK integration for blockchain operations
- Comprehensive error handling
- Request validation with Zod

### Testing

- 26+ integration tests covering core flows
- Auth, payments, and creator endpoints tested
- Webhook dispatch verification
