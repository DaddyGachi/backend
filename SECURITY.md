# Security Policy

## Reporting a Vulnerability

Dorisio Backend handles payments and wallet management on the Stellar blockchain. Security is critical. If you discover a vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

## Reporting Process

1. **Email** security@dorisio.com with:
   - Vulnerability description
   - Affected components and versions
   - Steps to reproduce
   - Potential impact (especially regarding wallet keys or payments)
   - Your contact information

2. **Response Timeline:**
   - Initial acknowledgment: within 48 hours
   - Assessment and remediation plan: within 5 business days
   - Coordinated disclosure: 30-90 day grace period before public announcement

3. **Coordinated Disclosure:** We request adequate time to develop, test, and release a fix.

## Security Best Practices

When deploying Dorisio Backend:

- **Never commit secrets** (private keys, API keys, database credentials) to version control
- **Use environment variables** for all sensitive configuration
- **Enable wallet verification** before processing any payment
- **Validate webhook signatures** using provided utilities (HMAC-SHA256)
- **Keep dependencies updated** — run `npm audit` regularly
- **Rate limiting is active** — 10 tips per user per hour (configurable)
- **Monitor logs** for suspicious payment patterns
- **Report suspicious activity** to security@dorisio.com immediately

## Wallet & Payment Security

- Always verify wallet ownership before processing payments
- Use Stellar testnet for development and staging
- Implement transaction confirmation monitoring
- Keep private keys in secure HSM or key management service
- Rotate credentials regularly
- Audit payment logs for anomalies

## Supported Versions

| Version | Status | Security Updates |
|---------|--------|------------------|
| 0.1.x   | Current | Yes |

## Contact

**Security Email:** security@dorisio.com
