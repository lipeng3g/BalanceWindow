# Balance Window Web

This directory contains the open-source web app for Balance Window, a local-first personal cash-flow planner.

- iOS product: <https://balancewindow.top/>
- Public web app: <https://app.balancewindow.top/>
- Privacy: <https://balancewindow.top/privacy>
- Support: <https://balancewindow.top/support>

## Features

- Track a small set of cash and savings accounts;
- Add one-time and recurring income or expenses;
- Review historical and projected balances;
- Inspect the timeline by day, week, or month;
- Import and export JSON backups;
- Use optional encrypted cloud backup and sync.

## Development

```bash
npm install
npm test
npm run type-check
npm run build
```

The app uses React, TypeScript, Vite, Semi Design, VChart, Zustand, Hono, Cloudflare Pages/D1, and Vitest.

Do not commit Cloudflare secrets, OAuth credentials, Apple private keys, session cookies, or personal financial data.
