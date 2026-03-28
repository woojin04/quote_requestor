# quote_requestor

Cloudflare Pages static form with a Pages Function that emails submissions.

## Required Cloudflare Pages environment variables

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_TO_EMAIL`

## Deploy notes

- Keep the project connected to Git so the `functions/` directory is deployed.
- In Cloudflare Pages, set:
  - Framework preset: `None`
  - Build command: leave empty
  - Build output directory: `/`
