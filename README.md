# mplocaltime

## Deployment

1. Create a local `.env` file from `.env.example` and add your values:

```bash
cp .env.example .env
# then edit .env and set JWT_SECRET, INITIAL_PASSWORD, INITIAL_USER_PASSWORD and VERCEL_TOKEN
```

Default seeded accounts:
- admin / changeme (admin)
- reporter / contributor (user)

You can override the default passwords with `INITIAL_PASSWORD` and `INITIAL_USER_PASSWORD`.

2. Deploy to Vercel:

```bash
cd /workspaces/mplocaltime
npx vercel --prod --yes
```

If you prefer interactive login instead of a token, run `npx vercel login` first.
