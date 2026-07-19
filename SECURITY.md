# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in mailroute, please report it privately by emailing **admin@finchtech.my**.

Please do **not** report security vulnerabilities through public GitHub issues.

You should receive a response within 48 hours. If you don't, follow up to ensure your message was received.

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential mitigations you've identified

## Scope

Security issues include, but are not limited to:

- SQL injection
- Cross-site scripting (XSS)
- Authentication or authorization bypass
- Exposure of sensitive data
- Server-side request forgery (SSRF)
- Remote code execution

We consider the following **out of scope**:

- Rate limiting bypass for non-sensitive endpoints
- Missing security headers that don't result in a direct vulnerability
- Theoretical attacks without a practical proof of concept
