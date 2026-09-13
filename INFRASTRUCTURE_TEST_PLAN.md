# Infrastructure End-to-End Test Plan

This document outlines the comprehensive test scenarios for validating all production infrastructure enhancements added in this release.

## Test Environment Setup

**Prerequisites:**
- Redis server running (required for BullMQ queues)
- PostgreSQL database with migrated schema
- Environment variables configured (.env.test)
- Node.js 20+

**Command to start tests:**
```bash
npm run test
```

## Infrastructure Components Tested

### 1. BullMQ + Redis Queue System
**File:** `src/lib/queue.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 1.1 | Redis connection established | Queue instance created without errors |
| 1.2 | Job queue initialization | Both `stellar-confirmation` and `webhook-dispatch` queues initialized |
| 1.3 | Job enqueueing | Jobs can be added to queue with proper serialization |
| 1.4 | Job retrieval | Enqueued jobs can be retrieved and processed |
| 1.5 | Queue persistence | Jobs survive Redis reconnection |

---

### 2. Stellar Confirmation Polling (Async Worker)
**Files:** 
- `src/domains/payments/payment.service.ts` (createTip)
- `src/lib/workers/stellar-confirmation.worker.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 2.1 | Tip creation queues confirmation job | Job added to `stellar-confirmation` queue |
| 2.2 | Worker polls Stellar transaction | Worker queries Stellar RPC with transaction hash |
| 2.3 | Confirmation updates tip status | Tip status changes from `pending` to `confirmed` |
| 2.4 | Failed confirmation marks tip failed | Transaction not found → tip status = `failed` |
| 2.5 | Retry logic on temporary failure | Job retried with exponential backoff (2s, 4s, 8s, 16s, 32s) |
| 2.6 | Max retries (5) → final status | After 5 failed attempts, tip marked as `failed` |
| 2.7 | Confirmed tip triggers webhook dispatch | Webhook event queued when status changes to `confirmed` |

---

### 3. Webhook Dispatch System with Retry
**Files:**
- `src/domains/webhooks/webhook.service.ts`
- `src/domains/webhooks/webhook.routes.ts`
- `src/lib/workers/webhook-dispatch.worker.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 3.1 | POST /api/v1/webhooks registers webhook | Webhook stored with HMAC secret and event filters |
| 3.2 | GET /api/v1/webhooks lists creator's webhooks | Returns array of registered webhooks |
| 3.3 | DELETE /api/v1/webhooks/:id removes webhook | Webhook deleted; no further events dispatched |
| 3.4 | Event dispatch creates job | When tip confirmed, webhook event queued |
| 3.5 | Webhook delivery attempts HTTP POST | POST request sent to webhook URL with JSON payload |
| 3.6 | HMAC-SHA256 signature verification | Signature header computed correctly for validation at webhook receiver |
| 3.7 | Retry on 5xx or timeout | Failed delivery retried with exponential backoff |
| 3.8 | Max 5 retries then marked failed | After 5 attempts, event marked as permanently failed |
| 3.9 | GET /api/v1/webhooks/:id/history returns delivery logs | Delivery history includes timestamp, status, response code |
| 3.10 | Event filtering by type | Webhook only receives subscribed event types (tip.created, tip.confirmed, etc.) |

---

### 4. Analytics Endpoints
**Files:**
- `src/domains/analytics/analytics.service.ts`
- `src/domains/analytics/analytics.routes.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 4.1 | GET /api/v1/analytics/summary returns stats | Response includes total_earnings, tip_count, unique_supporters, avg_tip |
| 4.2 | Summary queries confirmed tips only | Pending/failed tips excluded from calculations |
| 4.3 | GET /api/v1/analytics/earnings with days param | Returns daily earnings breakdown for last N days |
| 4.4 | Earnings query respects date range | Data filtered to requested period only |
| 4.5 | GET /api/v1/analytics/supporters returns top supporters | Returns sorted list of top N supporters by total amount |
| 4.6 | Supporters limit param enforced | Maximum 100 supporters returned regardless of input |
| 4.7 | GET /api/v1/analytics/frequency returns statistics | Response includes avg/min/max tip amounts and daily frequency |
| 4.8 | Frequency date validation | Invalid days (< 1 or > 365) rejected with 400 status |
| 4.9 | Auth required for all analytics | Unauthenticated requests return 401 |
| 4.10 | Creator isolation | Each creator only sees their own analytics data |

---

### 5. Admin/Moderation Layer
**Files:**
- `src/domains/admin/admin.service.ts`
- `src/domains/admin/admin.routes.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 5.1 | POST /api/v1/admin/wallets/:address/flag creates flag | WalletFlag record created with severity and reason |
| 5.2 | Flag severity levels stored | Severity (low/medium/high/critical) persisted |
| 5.3 | flagWallet returns flag ID | Admin receives flag ID for reference |
| 5.4 | isWalletFlagged() returns true for flagged wallet | Query returns true when wallet has active flag |
| 5.5 | POST /api/v1/admin/wallets/flags/:flagId/resolve removes flag | Flag deleted; isWalletFlagged returns false |
| 5.6 | POST /api/v1/admin/creators/:creatorId/freeze freezes account | AccountFreeze record created with reason and optional duration |
| 5.7 | Freeze duration optional | Null duration = indefinite freeze |
| 5.8 | isAccountFrozen() returns true for frozen account | Query returns true when creator has active freeze |
| 5.9 | POST /api/v1/admin/creators/freezes/:freezeId/resolve unfreezes | Freeze deleted; isAccountFrozen returns false |
| 5.10 | GET /api/v1/admin/moderation returns active flags + freezes | Moderation queue shows all pending reviews |
| 5.11 | Admin-only access | Non-admin users get 403 Forbidden |
| 5.12 | Admin role check enforced | Only users with role='ADMIN' can access endpoints |

---

### 6. Prometheus Metrics Endpoint
**Files:**
- `src/lib/metrics.ts`
- `src/routes/metrics.routes.ts`

**Test Scenarios:**

| # | Test | Expected Outcome |
|---|------|------------------|
| 6.1 | GET /metrics returns Prometheus format | Response Content-Type: text/plain; charset=utf-8 |
| 6.2 | Prometheus metrics are valid | Output parseable by Prometheus server |
| 6.3 | Counters increment on events | tipCounter, paymentCounter, webhookCounter, authCounter tracked |
| 6.4 | Gauges update from database | activeTipsGauge, confirmedTipsGauge, usersGauge reflect current state |
| 6.5 | Histograms track latencies | requestDurationHistogram, dbQueryDurationHistogram populated |
| 6.6 | GET /metrics/json returns JSON | Alternative JSON format for non-Prometheus tooling |
| 6.7 | JSON metrics include app state | JSON response includes pending_tips, confirmed_tips, total_earnings_usd |
| 6.8 | Uptime reported correctly | uptime_seconds in JSON matches process.uptime() |
| 6.9 | Memory usage tracked | memory_usage_mb and memory_total_mb calculated correctly |
| 6.10 | Metrics endpoint public | No auth required; accessible for monitoring agents |

---

## Integration Test Scenarios

### Scenario A: Full Tip → Confirmation → Webhook Flow

**Preconditions:**
- Creator and user registered
- Webhook registered for creator with `tip.confirmed` event filter

**Steps:**
1. User sends POST /api/v1/tips with amount and creatorId
2. System creates Tip with status=pending
3. Stellar transaction submitted, hash stored
4. Job added to `stellar-confirmation` queue
5. Worker polls Stellar after 2-5 second delays
6. Transaction confirmed on blockchain
7. Tip status updated to confirmed
8. WebhookEvent created for tip.confirmed event
9. Job added to `webhook-dispatch` queue
10. Worker POST's event to webhook URL
11. Webhook receives signed payload with HMAC verification
12. Analytics queries reflect new earnings

**Validation:**
- Tip progresses through all states correctly
- Database consistency maintained
- Webhook event has valid HMAC signature
- /api/v1/analytics/summary shows updated total_earnings

---

### Scenario B: Webhook Retry on Failure

**Preconditions:**
- Webhook URL returns 500 (simulated flaky service)
- Event created and queued

**Steps:**
1. Worker attempts first POST (fails: 500)
2. Job requeued with 2s delay
3. Second attempt (fails: 500, delay increases to 4s)
4. Third attempt (fails: 500, delay → 8s)
5. Fourth attempt (fails: 500, delay → 16s)
6. Fifth attempt (fails: 500, delay → 32s)
7. After 5 attempts, event marked `failed`
8. Admin queries /api/v1/webhooks/:id/history

**Validation:**
- All 5 attempts recorded with timestamps
- Exponential backoff correctly applied
- Event marked as failed after max retries

---

### Scenario C: Admin Wallet Flagging and Payment Rejection

**Preconditions:**
- Admin user registered with role='ADMIN'
- Tip from flagged wallet pending

**Steps:**
1. Admin POST /api/v1/admin/wallets/:address/flag with severity=critical
2. WalletFlag created
3. Payment service calls adminService.isWalletFlagged(address)
4. Returns true → payment rejected before Stellar submission
5. Admin queries /api/v1/admin/moderation
6. Flag appears in moderation queue
7. Admin POST /api/v1/admin/wallets/flags/:flagId/resolve
8. Flag deleted, wallet unflagged

**Validation:**
- Flagged wallet prevents payment processing
- Moderation queue accurate
- Flag resolution removes block

---

### Scenario D: Account Freeze and Analytics Isolation

**Preconditions:**
- Creator account with existing tips
- Admin user available

**Steps:**
1. Admin POST /api/v1/admin/creators/:creatorId/freeze with duration=24
2. AccountFreeze created with expiresAt = now + 24 hours
3. Creator attempts to access analytics (should still work but account frozen)
4. adminService.isAccountFrozen(creatorId) returns true
5. Payment processing checks freeze status
6. Frozen account cannot receive new tips
7. Admin POST /api/v1/admin/creators/freezes/:freezeId/resolve
8. Freeze deleted, tips can resume

**Validation:**
- Freeze prevents incoming tips
- Analytics remain queryable during freeze
- Freeze expiration handled correctly

---

## Performance & Load Testing

### Metrics to Validate

| Metric | Target | Validation |
|--------|--------|------------|
| Tip confirmation time | < 30s | Worker polls complete within target |
| Webhook delivery (success) | < 2s | POST to webhook URL completes quickly |
| Analytics query time | < 500ms | /api/v1/analytics/* queries performant |
| Metrics endpoint response | < 100ms | /metrics endpoint fast |
| Queue throughput | > 100 jobs/sec | BullMQ handles load |
| Concurrent webhooks | > 50 simultaneous | Worker handles concurrent retries |

---

## Test Execution Checklist

- [ ] Redis server running
- [ ] PostgreSQL migrated
- [ ] Environment variables loaded
- [ ] `npm run build` succeeds (no TypeScript errors)
- [ ] All imports registered in src/index.ts
- [ ] Routes registered: webhooks, analytics, admin, metrics
- [ ] Scenario A: Full flow passes
- [ ] Scenario B: Retry logic validated
- [ ] Scenario C: Admin flagging works
- [ ] Scenario D: Account freeze works
- [ ] Metrics endpoints responding
- [ ] Performance targets met

---

## Files Modified in This Release

**New Files:**
- `src/lib/metrics.ts` - Prometheus metrics definitions
- `src/lib/queue.ts` - BullMQ/Redis queue setup
- `src/lib/workers/stellar-confirmation.worker.ts` - Async confirmation polling
- `src/lib/workers/webhook-dispatch.worker.ts` - Webhook retry logic
- `src/domains/webhooks/webhook.service.ts` - Webhook registration & dispatch
- `src/domains/webhooks/webhook.routes.ts` - Webhook API endpoints
- `src/domains/analytics/analytics.service.ts` - Analytics queries
- `src/domains/analytics/analytics.routes.ts` - Analytics API endpoints
- `src/domains/admin/admin.service.ts` - Admin operations
- `src/domains/admin/admin.routes.ts` - Admin API endpoints
- `src/routes/metrics.routes.ts` - Prometheus & JSON metrics endpoints

**Modified Files:**
- `src/index.ts` - Registered all new route handlers
- `src/domains/payments/payment.service.ts` - Integrated queue for confirmation polling
- `package.json` - Added: bullmq, redis, prom-client

---

## Rollback Plan

If critical issues discovered:
1. Revert src/index.ts route registrations to commit before infrastructure changes
2. Restore previous payment.service.ts (without queue integration)
3. Remove new files: queue.ts, workers/*, admin/*, analytics/*, webhooks/*, routes/metrics.routes.ts
4. Downgrade package.json to previous dependency versions
5. Delete Prisma models for new tables if schema changes required

---

## Success Criteria

Infrastructure is production-ready when:
1. ✓ All 6 components (BullMQ, Stellar polling, webhooks, analytics, admin, metrics) compile and run
2. ✓ Integration Scenario A passes: Tip flow → confirmation → webhook dispatch
3. ✓ Retry logic validated: Webhook retries exponential backoff
4. ✓ Admin layer blocks flagged wallets and frozen accounts
5. ✓ Analytics queries return accurate data with proper isolation
6. ✓ Metrics endpoints respond with valid Prometheus/JSON format
7. ✓ Performance targets met for critical paths
8. ✓ Zero runtime errors in 10-minute smoke test

**Status:** Ready for task #8 (commit and push)
