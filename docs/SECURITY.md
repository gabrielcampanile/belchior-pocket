# Security Baseline

- Enforce row ownership with RLS for user financial data and verify policies whenever tables or access paths change.
- Keep Supabase service-role keys, provider credentials, and OAuth secrets server-side; never expose them in client bundles.
- Validate and normalize external input at server boundaries.
- Avoid logging credentials, tokens, raw account identifiers, or unnecessary transaction details.
- Minimize retention of provider payloads and document why any raw payload is stored.
- Treat closed-period edits, imports, and synchronization as security-sensitive data mutations.
- Review authentication flows and third-party dependencies before removing or replacing existing integrations.
- Security review is required for changes to auth, RLS, privileged functions, provider connections, or secrets.

This is a project baseline, not a substitute for reviewing the concrete implementation and deployment configuration.
