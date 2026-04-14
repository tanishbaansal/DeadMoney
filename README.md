# Dead Money

> Your idle crypto is dead money. Let's fix them.

**Live:** [deadmoney.vercel.app](https://deadmoney.vercel.app/)

Dead Money is a wallet x-ray that turns idle crypto into yield with one click. Paste any address or ENS, it scans every balance across chains, flags the assets sitting at 0% APY, and one-signs you into the best available vault — Morpho, Aave, Yearn, Euler, whatever. Twenty-plus protocols behind a single **Fix** button.

Business in the front. Li.Fi apis are in the back earning yeild with Morpho / Aave / Yearn vaults.

Built for the **[LI.FI DeFi Mullet Hackathon #1](https://li.fi/)** — Track 3: DeFi UX Challenge.

---

## What it does

1. **Scan** — Drop in any wallet address or ENS name (`vitalik.eth` works). Dead Money pulls the full portfolio across chains, shows current yield positions, and flags idle assets earning zero.
2. **Rank** — For each idle asset, we fetch the highest-APY vault on its chain that's actually transactable via LI.FI Composer.
3. **Fix** — One button. One signature. Funds land in the vault. Withdraw anytime with another single signature.

No smart contracts of our own. No bridges stitched together by hand. No protocol-specific SDKs. LI.FI Earn ate all the complexity and we built the UX on top.

---

## Architecture

Two LI.FI services power the entire app:

```
┌─────────────────────────────┐      ┌────────────────────────────┐
│  Earn Data API (no auth)    │      │  Composer (API key)        │
│  earn.li.fi                 │      │  li.quest                  │
│                             │      │                            │
│  GET /v1/earn/vaults        │      │  GET /v1/quote             │
│  GET /v1/earn/portfolio/    │      │  GET /v1/analytics/        │
│      :addr/positions        │      │      transfers             │
└──────────────┬──────────────┘      └───────────────┬────────────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │   Dead Money UI   │
                    │   (Remix + wagmi) │
                    └───────────────────┘
```

**Key design decision:** the Composer API key lives server-side only. All `/v1/quote` calls are proxied through a Remix action at `app/routes/api.quote.ts` — the browser never sees the key.

---

## Stack

- **[React Router v7](https://reactrouter.com/)** (Remix) + Vite for SSR and API routes
- **[TypeScript](https://www.typescriptlang.org/)** throughout
- **[Tailwind CSS](https://tailwindcss.com/)** for styling
- **[wagmi](https://wagmi.sh/) + [viem](https://viem.sh/)** for wallet & on-chain interaction
- **[Privy](https://privy.io/)** for wallet auth (works with email, MetaMask, Phantom, etc.)
- **[LI.FI Earn Data API](https://docs.li.fi/earn/overview)** for vault discovery and portfolio
- **[LI.FI Composer](https://docs.li.fi/)** for transaction building (deposit + withdraw)

Supported chains: Ethereum, Base, Arbitrum, Optimism, Polygon.

---

## Project layout

```
app/
├── routes/
│   ├── home.tsx            Landing page
│   ├── scan.tsx            Wallet scan + idle-asset report + Fix flow
│   ├── deposits.tsx        Portfolio view + withdraw flow
│   └── api.quote.ts        Server-side Composer proxy (API key lives here)
├── components/
│   ├── FixModal.tsx        Deposit modal — quote, approve, sign
│   ├── WithdrawModal.tsx   Withdraw modal — handles rebasing aTokens + retry ladder
│   ├── DeadMoneyReport.tsx Idle-asset report card
│   ├── MyDeposits.tsx      Active positions list
│   └── ...                 (AddressInput, Toast, ShareCard, etc.)
├── hooks/
│   ├── usePortfolio.ts     Portfolio + tx-history merge
│   └── useComposerQuote.ts Quote fetcher with reactive params
└── lib/
    ├── earnApi.ts          All Earn Data API calls + APY/URL helpers
    ├── composerApi.ts      Composer quote client (calls the server proxy)
    ├── deadMoney.ts        "Idle asset" detection + USD / APY formatters
    ├── tokens.ts           Chain names + token metadata
    └── viem.ts             Public-client factory per chain
```

---

## Running locally

You need Node 20+ and pnpm (or npm/bun). You'll also need:

- A **LI.FI Composer API key** from [portal.li.fi](https://portal.li.fi/)
- An **Alchemy API key** from [alchemy.com](https://www.alchemy.com/) (for RPC)
- A **Privy App ID** from [dashboard.privy.io](https://dashboard.privy.io/) (for wallet auth)

Copy `env.example` to `.env.local` and fill in the values:

```bash
cp env.example .env.local
```

```env
VITE_PRIVY_APP_ID=your_privy_app_id
COMPOSER_API_KEY=your_composer_key
ALCHEMY_API_KEY=your_alchemy_key
```

Then install and run:

```bash
pnpm install
pnpm dev
```

App runs at `http://localhost:5173`. In dev, the Vite config proxies `/earn-api` → `earn.li.fi` and `/composer-api` → `li.quest` to dodge CORS.

### Build

```bash
pnpm build
pnpm start
```

---

## The two-API flow, annotated

**Scan a wallet** (`app/routes/scan.tsx`):

```ts
// earnApi.ts:166 — no auth, just vibes
const positions = await getPortfolioPositions(userAddress);
// merged with li.quest/v1/analytics/transfers for tx history
```

**Find the best vault** for an idle asset:

```ts
// earnApi.ts:158 — filters isTransactional, sorts by APY
const vault = await getBestVault(chainId, tokenAddress);
// APY fallback: apy7d → apy1d → analytics.apy.total
```

**Build the deposit tx** (`app/components/FixModal.tsx`):

```ts
// composerApi.ts → /api/quote → li.quest/v1/quote
const quote = await getComposerQuote({
  fromChain: chainId, toChain: chainId,
  fromToken: tokenAddress,
  toToken: vault.address,      // the vault address IS the toToken
  fromAddress: user, toAddress: user,
  fromAmount: amount,
});
// quote.transactionRequest is ready for wagmi to sign
```

Withdraw is the mirror — same `/v1/quote` call, vault address becomes `fromToken`, underlying asset becomes `toToken`.

---

## Notable implementation details

- **aToken rebase handling** — Aave aTokens rebase every block, so the cached `stakedTokenAmount` from the backend drifts. `WithdrawModal` reads the live on-chain balance with wagmi and applies a small dust buffer to avoid liquidity-index underflow at submit time.
- **Retry ladder on withdraw** — If Composer's simulation reverts (edge-case routing math), we retry at 99% / 98% / 95% / 90% of the live balance before giving up. Users still get effectively-full redemption without hitting "execution reverted" walls.
- **APY fallback chain** — Newer vaults often return `apy7d: null`. We fall through to `apy1d`, then `analytics.apy.total`, so nothing renders as 0% APY unless it actually is.
- **Protocol deep links** — Every position links to the native protocol UI (Morpho, Yearn, Euler, etc.) so users are never locked into Dead Money's view of the world.
- **Server-side API key** — Composer quotes go through `app/routes/api.quote.ts`; the key is never exposed to the client. Earn Data API needs no auth, so that stays client-side for faster UX.

---

## Hackathon submission

- **Track:** DeFi UX Challenge
- **Hook:** *Your idle crypto is dead money.*
- **Live URL:** [deadmoney.vercel.app](https://deadmoney.vercel.app/)

---

## Roadmap

- Auto-rebalancer — watch APY drift and migrate positions when the delta clears gas + slippage.
- "Dead Money score" per wallet — a public, shareable grade based on % of stables earning zero.
- Telegram bot using the same API layer: `/scan 0x…`, `/fix 500 USDC`.
- Percentage presets on deposit / withdraw (25 / 50 / 75 / Max).
- Expand beyond stables — ETH LSTs, BTC-denominated vaults, LP positions.

---

## Credits

Built for the LI.FI DeFi Mullet Hackathon. Huge thanks to the LI.FI team for the Earn API — cleanest yield integration I've touched.
