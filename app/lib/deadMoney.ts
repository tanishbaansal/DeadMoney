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

  console.log("[detectIdleAssets] deployedKeys:", [...deployedKeys]);

  const idle: IdleAsset[] = [];

  for (const bal of balances) {
    const key = `${bal.token.chainId}:${bal.token.address.toLowerCase()}`;

    // if (bal.usdValue < MIN_IDLE_USD) {
    //   console.log(`[detectIdleAssets] SKIP ${bal.token.symbol} chain${bal.token.chainId} — below $10 ($${bal.usdValue.toFixed(2)})`);
    //   continue;
    // }
    if (deployedKeys.has(key)) {
      console.log(`[detectIdleAssets] SKIP ${bal.token.symbol} chain${bal.token.chainId} — already deployed`);
      continue;
    }

    const bestVault = vaultMap.get(key) ?? null;
    const bestApy = bestVault ? getBestApyFromVault(bestVault) : 0;
    const yearlyLoss = calcYearlyLoss(bal.usdValue, bestApy);

    console.log(`[detectIdleAssets] IDLE ${bal.token.symbol} chain${bal.token.chainId}: $${bal.usdValue.toFixed(0)}, vault=${bestVault?.name ?? "none"}, apy=${bestApy.toFixed(2)}%, loss=$${yearlyLoss.toFixed(0)}/yr`);

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
  console.log("[buildReport] inputs — balances:", balances.length, "positions:", positions.length, "vaultMap size:", vaultMap.size);
  console.log("[buildReport] balances:", balances.map(b => `${b.token.symbol}(chain${b.token.chainId})=$${b.usdValue.toFixed(0)}`));
  console.log("[buildReport] positions:", positions.map(p => `${p.vault?.asset ?? "unknown"}(chain${p.chainId})`));
  console.log("[buildReport] vaultMap keys:", [...vaultMap.keys()]);

  const idleAssets = detectIdleAssets(balances, positions, vaultMap);

  console.log("[buildReport] idle assets found:", idleAssets.length);
  idleAssets.forEach(a => {
    console.log(`[buildReport]   ${a.token.symbol} chain${a.token.chainId}: $${a.usdValue.toFixed(0)} idle, APY=${a.bestApy.toFixed(2)}%, yearly loss=$${a.yearlyLossUsd.toFixed(0)}, vault=${a.bestVault?.name ?? "none"}`);
  });

  const totalIdleUsd = idleAssets.reduce((s, a) => s + a.usdValue, 0);
  const totalDeployedUsd = positions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0);
  const totalUsd = totalIdleUsd + totalDeployedUsd;
  const totalYearlyLoss = idleAssets.reduce((s, a) => s + a.yearlyLossUsd, 0);
  const totalDailyLoss = idleAssets.reduce((s, a) => s + a.dailyLossUsd, 0);
  const score = calcDeadMoneyScore(totalDeployedUsd, totalUsd);

  console.log(`[buildReport] totalIdle=$${totalIdleUsd.toFixed(0)}, totalDeployed=$${totalDeployedUsd.toFixed(0)}, yearlyLoss=$${totalYearlyLoss.toFixed(0)}, score=${score}`);

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
  if (showCents || Math.abs(amount) < 100) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
