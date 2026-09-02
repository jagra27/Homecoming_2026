# Personalized Share Service

The Cloudflare Worker stores personalized card previews in R2 and returns unique links with crawler-visible Open Graph metadata.

## Setup

1. Authenticate Wrangler locally with `npm run worker:login`.
2. Create the buckets with `npm run worker:create-buckets`.
3. Deploy with `npm run worker:deploy`.
4. Add the deployed Worker URL as the GitHub Actions repository variable `VITE_SHARE_API_URL`.
5. Configure an R2 lifecycle rule to delete `cards/` objects after the desired invitation lifetime.

The Worker accepts uploads only from the production GitHub Pages origin and local Vite origins. Do not place Cloudflare credentials in an environment file or commit them to the repository.