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
  protocol: string;
  asset: string; // underlying token address
  isTransactional: boolean;
  apy7d: number | null;
  apy1d: number | null;
  analytics: VaultAnalytics;
  tags?: string[];
  logoUrl?: string;
  protocolLogoUrl?: string;
}

export interface Position {
  id: string;
  chainId: number;
  vault: Vault;
  userAddress: string;
  stakedTokenAmount: string;
  stakedTokenAmountUsd: number;
}

export interface PortfolioResponse {
  positions: Position[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getBestApy(vault: Vault): number {
  // Fallback chain: apy7d → apy1d → analytics.apy.total → 0
  if (vault.apy7d != null && vault.apy7d > 0) return vault.apy7d;
  if (vault.apy1d != null && vault.apy1d > 0) return vault.apy1d;
  if (vault.analytics?.apy?.total != null && vault.analytics.apy.total > 0)
    return vault.analytics.apy.total;
  return 0;
}

export function getVaultTvl(vault: Vault): number {
  return parseFloat(vault.analytics?.tvl?.usd ?? "0");
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getVaults(chainId: number, assetAddress: string): Promise<Vault[]> {
  const params = new URLSearchParams({
    chainId: String(chainId),
    asset: assetAddress,
    sortBy: "apy",
    minTvl: "1000000",
  });

  const res = await fetch(EARN_PATH(`/v1/earn/vaults?${params}`), {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const vaults: Vault[] = Array.isArray(data) ? data : (data.vaults ?? data.data ?? []);

  // Only return transactional vaults with non-zero APY
  return vaults.filter((v) => v.isTransactional && getBestApy(v) > 0);
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
