# Balance Window

> See the balance before it moves.

Balance Window is an iOS-first, local-first cash-flow forecaster for people who want to understand the months ahead. Add the balance you have now, the paychecks and bills you already know, and the larger expenses you are planning. Balance Window turns those inputs into a clear projected balance and projected low point.

<p align="center">
  <a href="https://apps.apple.com/us/app/balance-window-cash-flow/id6804171868"><strong>Get Balance Window for iPhone</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://balancewindow.top/">See the product</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://app.balancewindow.top/">Try the open-source web app</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/ios-assets/01-low-balance.png" alt="Balance Window iOS overview showing a projected low balance" width="260">
</p>

The App Store page is prepared at the link above; availability still depends on Apple's review and release state.

## Why people use it

Balance Window is built around one practical question:

> How low might my balance go—and when?

- **See the low point early.** Find the projected minimum and the date behind it before a bill arrives.
- **Put known changes on one timeline.** Paychecks, rent, utilities, cards, subscriptions, and savings plans become a single cash-flow outlook.
- **Test a decision.** Add a planned expense and see how it changes the months that follow.
- **Keep the scope calm.** Track a few important accounts and changes instead of recording every coffee or connecting every bank.
- **Start privately.** The web app works locally first; optional encrypted cloud sync is available when you choose to sign in.

The forecast is a projection based on the information you enter. Balance Window is not a bank, payment service, accounting system, investment tracker, lending product, or source of financial advice.

## The iOS experience

The native iOS app is the primary product experience. It is designed for a quick check-in: open the app, understand the next low point, and decide whether a known change needs attention.

<p align="center">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/ios-assets/02-bills-paychecks.png" alt="Balance Window iOS ledger showing bills and paychecks" width="220">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/ios-assets/03-planned-expense.png" alt="Balance Window iOS planned expense scenario" width="220">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/ios-assets/04-account-focus.png" alt="Balance Window iOS account-focused forecast" width="220">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/ios-assets/05-local-first.png" alt="Balance Window iOS local-first data settings" width="220">
</p>

**Primary path:** [open the product page](https://balancewindow.top/) → [view the App Store listing](https://apps.apple.com/us/app/balance-window-cash-flow/id6804171868).

## Open-source desktop web app

This repository contains the open-source desktop web companion. It uses the same small-input forecasting idea and is useful for a larger screen, local experimentation, and transparent self-hosting. The iOS app remains the recommended way to use Balance Window day to day.

<p align="center">
  <img src="https://raw.githubusercontent.com/lipeng3g/future-money/main/web/public/desktop-assets/desktop-overview-legacy.png" alt="Legacy desktop preview of the Balance Window cash-flow planner" width="900">
</p>

The screenshot above is a **legacy desktop preview** from the earlier PC build. It is included to show the desktop workflow; the current brand and product direction are Balance Window.

- **Use the hosted app:** [app.balancewindow.top](https://app.balancewindow.top/)
- **Browse the source:** [github.com/lipeng3g/future-money](https://github.com/lipeng3g/future-money)
- **Read the web-specific notes:** [`web/README.md`](./web/README.md)

The native iOS source, Apple signing materials, release configuration, and private operational records are intentionally not part of this public repository.

## Run it yourself

The public repository is a small npm workspace. A local browser preview does not require Apple credentials or a bank connection.

```bash
git clone https://github.com/lipeng3g/future-money.git
cd future-money
npm install
npm run dev
```

Before publishing a production build, run the same checks used by CI:

```bash
npm run type-check
npm test
npm run build
```

The built `web/dist/` output can be published through Cloudflare Pages. Cloud sync and social sign-in require the corresponding server bindings and secrets; keep those values in the deployment environment, never in Git.

## Data and security

The web app is local-first. Do not commit Cloudflare secrets, OAuth credentials, Apple private keys, session cookies, or personal financial data. Export a backup before changing or clearing local data. See [Privacy](https://balancewindow.top/privacy) and [Support](https://balancewindow.top/support) for the public policies.

## Project links

| Destination | Link |
| --- | --- |
| iOS product page | [balancewindow.top](https://balancewindow.top/) |
| App Store listing | [Balance Window: Cash Flow](https://apps.apple.com/us/app/balance-window-cash-flow/id6804171868) |
| Hosted desktop web app | [app.balancewindow.top](https://app.balancewindow.top/) |
| Privacy | [balancewindow.top/privacy](https://balancewindow.top/privacy) |
| Support | [balancewindow.top/support](https://balancewindow.top/support) |
| Public source | [GitHub](https://github.com/lipeng3g/future-money) |

The repository slug and a few technical identifiers retain the historical `FutureMoney` name for update and deployment continuity. That name is not the current product brand.
