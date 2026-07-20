# DailyBloom monitoring

DailyBloom records unexpected server failures as structured, privacy-limited JSON in the hosting provider's runtime logs. Expected Next.js dynamic-rendering signals are ignored.

## Health check

`GET /api/health` returns a small, uncached service status response. It does not query Supabase or expose environment configuration.

## Optional alerts

Set `ERROR_ALERT_WEBHOOK_URL` in the hosting environment to send the same structured event to an HTTPS webhook. If it is not configured, logging continues normally and application requests are unaffected.

The webhook receiver must return a successful HTTP status within three seconds. Alert failures are logged and never replace the original application response.

Events contain the route, request method, deployment release, error reference and a bounded error message. Query strings, request headers, common contact details and bearer tokens are excluded or redacted.

## Initial alert policy

- Alert immediately when the same route produces repeated server errors.
- Treat parent login, incident reporting, messaging, payments and report submission as high-priority routes.
- Use `/api/health` for an external uptime check when a free monitoring provider is selected.
- Keep webhook secrets only in environment variables; never commit them to Git.
