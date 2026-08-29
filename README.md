# Balance Window

Balance Window is a local-first personal cash-flow planner. It uses the balance you have now, known paychecks, recurring bills, and planned expenses to show how your balance may change over time and where it may run low.

> Brand: **Balance Window** · App Store name: **Balance Window: Cash Flow** · Public web app: <https://balancewindow.top>
>
> The historical `FutureMoney` name remains only in approved technical identities—such as the repository slug and production Bundle ID—and in historical records. This development-stage reset does not preserve legacy business data or compatibility aliases.

## Web app

The open-source web app lives in [`web/`](./web/). It is built with React, TypeScript, Vite, Zustand, Hono, and Cloudflare Pages/D1.

```bash
npm install
npm test
npm run type-check
npm run build
```

The public pages are available at:

- App: <https://balancewindow.top>
- Privacy: <https://balancewindow.top/privacy>
- Support: <https://balancewindow.top/support>
- Product page: <https://balancewindow.top/ios>

## Product boundary

Balance Window is designed for a small set of important balances and known future changes. It is not a bank aggregator, detailed bookkeeping system, investment service, lending product, or source of financial advice.

## Security and data

The web app is local-first. Do not commit Cloudflare secrets, OAuth credentials, Apple private keys, session cookies, or personal financial data. The native iOS source and signing materials are maintained privately and are not part of the public repository.

## Documentation

The public product, data model, algorithm, architecture, and maintenance notes are indexed in [`docs/README.md`](./docs/README.md). Native iOS implementation and release records remain private.
