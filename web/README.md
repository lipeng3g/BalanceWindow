# Balance Window Web

This directory contains the open-source desktop web app for Balance Window, the iOS-first local-first personal cash-flow planner.

- iOS product: <https://balancewindow.top/>
- App Store page: <https://apps.apple.com/us/app/balance-window-cash-flow/id6804171868>
- Desktop web app: <https://app.balancewindow.top/>
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

Do not commit Cloudflare secrets, OAuth credentials, Apple private keys, session cookies, or personal financial data. The native iOS source and signing materials are maintained privately.
