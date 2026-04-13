import type { TokenInfo } from "./tokens";
import type { Position, Vault } from "./earnApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenBalance {
  token: TokenInfo;
  rawBalance: bigint;
  balance: number; // human-readable
  usdValue: number;
}

export interface IdleAsset {
  token: TokenInfo;
  balance: number;
  usdValue: number;
  bestVault: Vault | null;
  bestApy: number; // percentage, e.g. 8.4
  yearlyLossUsd: number;
  dailyLossUsd: number;
  daysIdle: number;
}

export interface DeadMoneyReport {
  address: string;
  idleAssets: IdleAsset[];
  totalIdleUsd: number;
  totalDeployedUsd: number;
  totalYearlyLossUsd: number;
  totalDailyLossUsd: number;
  deadMoneyScore: number; // 0–100 (lower = worse)
  scannedAt: number; // timestamp
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_DAYS_IDLE = 90;
const MIN_IDLE_USD = 10;

// ─── Core calculations ────────────────────────────────────────────────────────

export function calcYearlyLoss(idleUsd: number, apyPercent: number): number {
  return idleUsd * (apyPercent / 100);
}

export function calcDailyLoss(yearlyLoss: number): number {
  return yearlyLoss / 365;
}

export function calcDeadMoneyScore(deployedUsd: number, totalUsd: number): number {
  if (totalUsd === 0) return 0; // nothing detected = unknown, treat as worst
  return Math.round((deployedUsd / totalUsd) * 100);
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score <= 25) return { label: "CRITICAL", color: "#FF2D2D" };
  if (score <= 50) return { label: "POOR", color: "#FF6B35" };
  if (score <= 75) return { label: "FAIR", color: "#F5C518" };
  return { label: "GOOD", color: "#00D4AA" };
}

// ─── Idle detection ───────────────────────────────────────────────────────────

export function detectIdleAssets(
  balances: TokenBalance[],
  positions: Position[],
  vaultMap: Map<string, Vault | null> // key: `${chainId}:${tokenAddress}`
): IdleAsset[] {
  // Build a set of deployed token addresses (chainId:address)
  const deployedKeys = new Set<string>();
  for (const pos of positions) {
    // Guard: vault may be undefined if the API returns a stale/delisted position
    if (!pos.vault?.asset) continue;
    const key = `${pos.chainId}:${pos.vault.asset.toLowerCase()}`;
    deployedKeys.add(key);
  }

  const idle: IdleAsset[] = [];

  for (const bal of balances) {
    const key = `${bal.token.chainId}:${bal.token.address.toLowerCase()}`;

    if (deployedKeys.has(key)) {
      continue;
    }

    const bestVault = vaultMap.get(key) ?? null;
    const bestApy = bestVault ? getBestApyFromVault(bestVault) : 0;

    // Skip if there's no vault opportunity OR the APY is zero — nothing to "fix"
    if (!bestVault || bestApy <= 0) {
      continue;
    }

    const yearlyLoss = calcYearlyLoss(bal.usdValue, bestApy);

    idle.push({
      token: bal.token,
      balance: bal.balance,
      usdValue: bal.usdValue,
      bestVault,
      bestApy,
      yearlyLossUsd: yearlyLoss,
      dailyLossUsd: calcDailyLoss(yearlyLoss),
      daysIdle: DEFAULT_DAYS_IDLE,
    });
  }

  // Sort by yearly loss descending (worst first)
  return idle.sort((a, b) => b.yearlyLossUsd - a.yearlyLossUsd);
}

function getBestApyFromVault(vault: Vault): number {
  if (vault.apy7d != null && vault.apy7d > 0) return vault.apy7d;
  if (vault.apy1d != null && vault.apy1d > 0) return vault.apy1d;
  if (vault.analytics?.apy?.total != null && vault.analytics.apy.total > 0)
    return vault.analytics.apy.total;
  return 0;
}

export function buildReport(
  address: string,
  balances: TokenBalance[],
  positions: Position[],
  vaultMap: Map<string, Vault | null>
): DeadMoneyReport {

  const idleAssets = detectIdleAssets(balances, positions, vaultMap);

  // Only actionable idle (assets with a vault opportunity) counts as "dead money"
  const totalIdleUsd = idleAssets.reduce((s, a) => s + a.usdValue, 0);
  const totalDeployedUsd = positions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0);
  const totalYearlyLoss = idleAssets.reduce((s, a) => s + a.yearlyLossUsd, 0);
  const totalDailyLoss = idleAssets.reduce((s, a) => s + a.dailyLossUsd, 0);

  // Score: if nothing is actionable and user has deployed, they're at 100.
  // If nothing is deployed and nothing is actionable, there's no dead money → 100.
  let score: number;
  if (idleAssets.length === 0) {
    score = 100;
  } else {
    score = calcDeadMoneyScore(totalDeployedUsd, totalDeployedUsd + totalIdleUsd);
  }


  return {
    address,
    idleAssets,
    totalIdleUsd,
    totalDeployedUsd,
    totalYearlyLossUsd: totalYearlyLoss,
    totalDailyLossUsd: totalDailyLoss,
    deadMoneyScore: score,
    scannedAt: Date.now(),
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatUsd(amount: number, showCents = false): string {
  if (showCents || Math.abs(amount) < 100 || Math.abs(amount) < 1) {
    const decimals = Math.abs(amount) < 0.01 ? 2 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatApy(apy: number): string {
  return `${apy.toFixed(1)}%`;
}
