# quote_requestor

Cloudflare Pages static form with a Pages Function that emails submissions.

## Required Cloudflare Pages environment variables

- `RESEND_API_KEY`
- `RESEND_TO_EMAIL`

## Optional sender environment variables

- `EMAIL_FROM`
- `RESEND_FROM_EMAIL`

## Resend sender requirements

- `EMAIL_FROM` takes precedence over `RESEND_FROM_EMAIL`.
- If neither sender variable is set, the function uses `Acme <onboarding@resend.dev>` for testing.
- Do not use the placeholder `yourdomain.com` domain.
- For production, verify your domain in Resend and use a sender address on that verified domain.

## Deploy notes

- Keep the project connected to Git so the `functions/` directory is deployed.
- In Cloudflare Pages, set:
  - Framework preset: `None`
  - Build command: leave empty
  - Build output directory: `/`
