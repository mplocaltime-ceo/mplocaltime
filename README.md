# mplocaltime

## Deployment

1. Create a local `.env` file from `.env.example` and add your values:

```bash
cp .env.example .env
# then edit .env and set JWT_SECRET and VERCEL_TOKEN
```

2. Deploy to Vercel:

```bash
cd /workspaces/mplocaltime
npx vercel --prod --yes
```

If you prefer interactive login instead of a token, run `npx vercel login` first.
