// In dev, use the Vite proxy to avoid CORS. In prod, call directly.
const EARN_BASE =
  typeof window !== "undefined" && import.meta.env.DEV
    ? ""  // relative URL — goes through Vite proxy at /earn-api
    : "https://earn.li.fi";

const EARN_PATH = (path: string) =>
  typeof window !== "undefined" && import.meta.env.DEV
    ? `/earn-api${path}`
    : `https://earn.li.fi${path}`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultAnalytics {
  apy: {
    base: number | null;
    reward: number | null;
    total: number | null;
  };
  tvl: {
    usd: string; // Always parse with parseFloat!
  };
}

export interface Vault {
  id: string;
  address: string;
  chainId: number;
  name: string;
  protocol: string | { name?: string; key?: string; id?: string; url?: string; [k: string]: unknown };
  asset: string; // underlying token address
  isTransactional: boolean;
  apy7d: number | null;
  apy1d: number | null;
  analytics: VaultAnalytics;
  tags?: string[];
  logoUrl?: string;
  protocolLogoUrl?: string;
  url?: string;
  decimals?: number;
}

export interface Position {
  id: string;
  chainId: number;
  vault: Vault;
  userAddress: string;
  stakedTokenAmount: string;
  stakedTokenAmountUsd: number;
  txHash?: string;
  txLink?: string;
}

export interface PortfolioResponse {
  positions: Position[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getBestApy(vault: Vault | null | undefined): number {
  if (!vault) return 0;
  // Fallback chain: apy7d → apy1d → analytics.apy.total → 0
  if (vault.apy7d != null && vault.apy7d > 0) return vault.apy7d;
  if (vault.apy1d != null && vault.apy1d > 0) return vault.apy1d;
  if (vault.analytics?.apy?.total != null && vault.analytics.apy.total > 0)
    return vault.analytics.apy.total;
  return 0;
}

export function getVaultTvl(vault: Vault | null | undefined): number {
  if (!vault) return 0;
  return parseFloat(vault.analytics?.tvl?.usd ?? "0");
}

// Generate the best available link to the vault's page
export function getVaultUrl(vault: Vault | null | undefined): string {
  if (!vault) return "https://app.li.fi/earn";
  if (vault.url) return vault.url;
  // 1. Try protocol-specific URL from the API first (best deep link)
  if (typeof vault.protocol !== "string" && vault.protocol?.url) {
    return vault.protocol.url;
  }

  // protocol may be a string or an object with a name/key field
  const rawProtocol = vault.protocol;
  const protocol = (
    typeof rawProtocol === "string"
      ? rawProtocol
      : (rawProtocol as any)?.name ?? (rawProtocol as any)?.key ?? (rawProtocol as any)?.id ?? ""
  ).toLowerCase();
  const addr = vault.address?.toLowerCase();
  const chainSlug: Record<number, string> = {
    1: "ethereum", 8453: "base", 42161: "arbitrum", 10: "optimism", 137: "polygon",
  };
  const chain = chainSlug[vault.chainId] ?? "ethereum";

  // Protocol-specific deep links (fallbacks)
  if (protocol.includes("morpho")) return `https://app.morpho.org/vault?vault=${addr}&network=${chain}`;
  if (protocol.includes("aave")) return `https://app.aave.com/`;
  if (protocol.includes("compound")) return `https://app.compound.finance/`;
  if (protocol.includes("yearn")) return `https://yearn.fi/vaults/${vault.chainId}/${addr}`;
  if (protocol.includes("beefy")) return `https://app.beefy.com/`;
  if (protocol.includes("convex")) return `https://www.convexfinance.com/stake`;
  if (protocol.includes("pendle")) return `https://app.pendle.finance/trade/pools`;
  if (protocol.includes("fluid")) return `https://fluid.instadapp.io/`;
  if (protocol.includes("spark")) return `https://spark.fi/`;
  if (protocol.includes("euler")) return `https://app.euler.finance/`;

  // Fallback: LI.FI earn page
  return `https://app.li.fi/earn`;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getVaults(chainId?: number, assetAddress?: string): Promise<Vault[]> {
  const params = new URLSearchParams({
    sortBy: "apy",
    minTvl: "0", // Lowered from 100 to 0 for maximum discovery
  });
  if (chainId) params.set("chainId", String(chainId));
  
  if (assetAddress) {
    const addr = assetAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" 
      ? "0x0000000000000000000000000000000000000000" 
      : assetAddress;
    params.set("asset", addr);
  }

  const url = EARN_PATH(`/v1/earn/vaults?${params}`);
  console.log(`[earnApi] getVaults request: ${url}`);
  
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[earnApi] getVaults failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const vaults: Vault[] = Array.isArray(data) ? data : (data.vaults ?? data.data ?? []);
    
    // Filter for transactional vaults. APY can be 0 (discovery is better than none)
    const filtered = vaults.filter((v) => v.isTransactional);
    console.log(`[earnApi] getVaults: ${vaults.length} total -> ${filtered.length} transactional`);
    
    return filtered;
  } catch (err) {
    console.error("[earnApi] getVaults error:", err);
    return [];
  }
}

export async function getAllVaults(): Promise<Vault[]> {
  return getVaults();
}

export async function getBestVault(chainId: number, assetAddress: string): Promise<Vault | null> {
  const vaults = await getVaults(chainId, assetAddress);
  if (vaults.length === 0) return null;

  // Sort by best APY descending
  return vaults.sort((a, b) => getBestApy(b) - getBestApy(a))[0];
}

export async function getPortfolioPositions(userAddress: string): Promise<Position[]> {
  const res = await fetch(EARN_PATH(`/v1/earn/portfolio/${userAddress}/positions`), {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as PortfolioResponse | Position[];
  return Array.isArray(data) ? data : (data.positions ?? []);
}

// ─── Withdraw via LI.FI Earn API ──────────────────────────────────────────
// LI.FI's Earn API has a dedicated withdrawal endpoint that handles the
// protocol-specific quirks of rebasing vault positions (aTokens, etc.).
// This is what earn.li.fi itself uses, and is the correct LI.FI-native
// path for exiting positions — the Composer /v1/quote endpoint routes
// through an internal executor that breaks Aave withdraws.

export interface EarnWithdrawTx {
  to: string;
  data: string;
  value?: string;
  from?: string;
  chainId?: number;
  gasLimit?: string;
  gasPrice?: string;
}

export interface EarnWithdrawResponse {
  transactionRequest?: EarnWithdrawTx;
  transactionRequests?: EarnWithdrawTx[];
  approvalAddress?: string;
  [k: string]: unknown;
}

export async function getEarnWithdrawTx(params: {
  vaultAddress: string;
  chainId: number;
  userAddress: string;
  amount: string; // in smallest unit
  asset?: string;
}): Promise<EarnWithdrawResponse> {
  const body = {
    vaultAddress: params.vaultAddress,
    chainId: params.chainId,
    userAddress: params.userAddress,
    amount: params.amount,
    ...(params.asset ? { asset: params.asset } : {}),
  };

  const url = EARN_PATH(`/v1/earn/transactions/withdraw`);
  const apiKey = (import.meta.env.VITE_COMPOSER_API_KEY as string) ?? "";
  console.log(`[earnApi] withdraw request:`, url, body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-lifi-api-key": apiKey } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Earn withdraw failed: ${res.status} ${err.slice(0, 200)}`);
  }

  return res.json();
}

export async function getTransactionHistory(userAddress: string): Promise<any[]> {
  const url = `https://li.quest/v1/analytics/transfers?wallet=${userAddress}&limit=100`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const transfers = data.transfers ?? data.data ?? (Array.isArray(data) ? data : []);

  // Merge and deduplicate by transactionId/hash
  const seen = new Set();
  const lowerUser = userAddress.toLowerCase();
  
  return transfers.filter((t: any) => {
    const id = t.transactionId || t.status?.transactionId || t.receiving?.txHash || t.sending?.txHash;
    if (!id || seen.has(id)) return false;
    
    // Safety check: ensure our user is either the sender or receiver
    const isUserFrom = t.fromAddress?.toLowerCase() === lowerUser;
    const isUserTo = t.toAddress?.toLowerCase() === lowerUser || 
                     t.receiving?.address?.toLowerCase() === lowerUser;
    
    if (!isUserFrom && !isUserTo) return false;

    seen.add(id);
    return true;
  });
}
