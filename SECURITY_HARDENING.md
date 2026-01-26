# Security Hardening Documentation

This document outlines the comprehensive security hardening implemented for the AvLog application, following OWASP best practices.

## Security Enhancements Implemented

### 1. Rate Limiting ✅
- **General API Rate Limiter**: 100 requests per 15 minutes per IP
- **Image Processing Rate Limiter**: 20 requests per 15 minutes per IP
- **Extraction Rate Limiter**: 10 requests per 15 minutes per IP (most resource-intensive)
- **Admin Rate Limiter**: 50 requests per 15 minutes per IP
- **Webhook Rate Limiter**: 100 requests per 15 minutes per IP
- **Authenticated Rate Limiter**: 200 requests per 15 minutes per IP

All rate limiters:
- Skip OPTIONS preflight requests
- Return standard rate limit headers
- Log security alerts for excessive requests

### 2. Input Validation & Sanitization ✅

#### Sanitization Utilities (`server/utils/sanitize.ts`)
- **sanitizeString**: Removes HTML tags, null bytes, control characters
- **sanitizeText**: Sanitizes text for database storage (allows newlines)
- **sanitizeEmail**: Validates and sanitizes email addresses
- **sanitizeId**: Sanitizes URL parameters and IDs (alphanumeric, hyphens, underscores only)
- **sanitizeNumber/sanitizeInteger**: Validates numeric inputs with min/max bounds
- **sanitizeBoolean**: Converts various input types to boolean
- **sanitizeDate**: Validates date formats (YYYY-MM-DD or MM/DD/YYYY)
- **sanitizeStringArray**: Sanitizes arrays of strings
- **sanitizeForLogging**: Removes sensitive data from log objects

#### Validation Middleware (`server/middleware/validation.ts`)
- **validateAndSanitizeBody**: Validates and sanitizes request body fields
- **validateParams**: Validates and sanitizes URL parameters
- **validateQuery**: Validates and sanitizes query parameters

All user inputs are now:
- Type-checked
- Length-limited
- Sanitized to prevent XSS
- Validated against expected formats

### 3. Error Handling ✅
- Error messages no longer expose internal details in production
- Development mode includes error details for debugging
- All error responses are sanitized
- Sensitive information is redacted from logs

### 4. XSS Protection ✅
- All user inputs are sanitized before storage
- HTML entities are escaped in text fields
- Error messages in `index.tsx` are sanitized before rendering
- No `dangerouslySetInnerHTML` usage (except for error boundaries with sanitization)

### 5. Secure Logging ✅
- Sensitive data (passwords, tokens, secrets, API keys) are redacted from logs
- Request bodies and headers are sanitized before logging
- Only errors and slow requests (>5s) are logged in production

### 6. API Key Security ✅
- All API keys are stored in environment variables
- No hardcoded secrets in code
- Client-side only uses public keys (Supabase anon key)
- Service role keys are server-side only
- `.env` files are in `.gitignore`

### 7. Route Protection ✅
- All authenticated routes use `verifyAuth` middleware
- Admin routes use `verifyAdmin` middleware
- Rate limiting applied to all public endpoints
- Parameter validation on all dynamic routes

### 8. Input Length Limits ✅
- String fields: Max 10,000 characters (configurable)
- Text fields: Max 10,000 characters (configurable)
- Email: Max 255 characters
- IDs: Max 255 characters
- Arrays: Max 100 items, 100 characters per item

## Security Checklist

- [x] Rate limiting on all public endpoints
- [x] Input validation and sanitization
- [x] XSS protection
- [x] SQL injection prevention (Supabase handles this)
- [x] Error message sanitization
- [x] Secure logging (no sensitive data)
- [x] No hardcoded secrets
- [x] Environment variables for all secrets
- [x] Parameter validation
- [x] Request body validation
- [x] Query parameter validation
- [x] CORS properly configured
- [x] Helmet security headers
- [x] Trust proxy configuration

## OWASP Top 10 Coverage

1. **Injection**: ✅ Prevented via input sanitization and Supabase parameterized queries
2. **Broken Authentication**: ✅ JWT token validation, secure password handling
3. **Sensitive Data Exposure**: ✅ Sensitive data redacted from logs, HTTPS required
4. **XML External Entities (XXE)**: ✅ N/A (no XML parsing)
5. **Broken Access Control**: ✅ RLS policies, user ID verification on all operations
6. **Security Misconfiguration**: ✅ Security headers, CORS, environment variables
7. **XSS**: ✅ Input sanitization, HTML entity escaping
8. **Insecure Deserialization**: ✅ JSON parsing with validation
9. **Using Components with Known Vulnerabilities**: ✅ Regular dependency updates
10. **Insufficient Logging & Monitoring**: ✅ Security logging, rate limit alerts

## Environment Variables Required

All secrets must be stored in environment variables (never in code):

```bash
# API Keys (Server-side only)
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Supabase (Service role key is server-side only)
SUPABASE_URL=...
SUPABASE_ANON_KEY=... # Can be client-side
SUPABASE_SERVICE_ROLE_KEY=... # Server-side only

# Admin
ADMIN_SECRET_TOKEN=...
ADMIN_EMAILS=...

# Frontend URL
FRONTEND_URL=...
ALLOWED_ORIGINS=...
```

## Testing Security

1. **Rate Limiting**: Make rapid requests to any endpoint - should receive 429 after limit
2. **Input Validation**: Send malformed data - should receive 400 with validation errors
3. **XSS**: Try injecting `<script>` tags in text fields - should be sanitized
4. **Error Messages**: Trigger errors - should not expose internal details in production
5. **Authentication**: Try accessing protected routes without token - should receive 401

## Ongoing Security Maintenance

1. Regularly update dependencies (`npm audit`)
2. Review and rotate API keys periodically
3. Monitor security logs for suspicious activity
4. Keep rate limits tuned based on usage patterns
5. Review and update input validation rules as needed
6. Conduct periodic security audits

## Notes

- Supabase RLS (Row Level Security) provides additional database-level security
- All database operations use Supabase client which handles SQL injection prevention
- CORS is configured to only allow trusted origins in production
- Helmet provides additional security headers (CSP, HSTS, etc.)
