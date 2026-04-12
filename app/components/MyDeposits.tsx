import { useMemo, useState } from "react";
import { ExternalLink, TrendingUp, Vault, Sparkles } from "lucide-react";
import type { Position } from "~/lib/earnApi";
import { getBestApy, getVaultUrl } from "~/lib/earnApi";
import { calculateYearlyYield, estimateTotalGrowth } from "~/lib/deposits";
import { formatApy, formatUsd } from "~/lib/deadMoney";
import { CHAIN_NAMES } from "~/lib/tokens";
import { WithdrawModal } from "./WithdrawModal";

interface MyDepositsProps {
  positions: Position[];
  walletAddress: string;
  onWithdrawn?: () => void;
}

export function MyDeposits({ positions, walletAddress, onWithdrawn }: MyDepositsProps) {
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Position | null>(null);
  const yearlySaved = useMemo(() => calculateYearlyYield(positions), [positions]);
  const currentGrowth = useMemo(() => estimateTotalGrowth(positions), [positions]);
  const totalDeposited = useMemo(() => positions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0), [positions]);

  const validPositions = useMemo(() => positions.filter(p => !!p.vault), [positions]);

  if (validPositions.length === 0) return null;

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center">
            <Vault className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#f0f0f5] text-lg leading-none">My Deposits</h2>
            <p className="text-xs text-[#5a5a6a] mt-0.5">On-chain yield-bearing assets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa] text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4aa]"></span>
          </span>
          {validPositions.length} active
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl bg-[#111118] border border-[#1e1e2c] p-4 text-center group hover:border-[#00d4aa]/30 transition-all cursor-default">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a6a] mb-1 group-hover:text-[#00d4aa] transition-colors font-semibold">Total Deposited</p>
          <p className="font-mono font-bold text-[#f0f0f5] text-xl">{formatUsd(totalDeposited)}</p>
        </div>
        <div className="rounded-2xl bg-[#00d4aa]/5 border border-[#00d4aa]/20 p-4 text-center group hover:bg-[#00d4aa]/10 transition-all cursor-default relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00d4aa]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] uppercase tracking-wider text-[#00d4aa] mb-1 font-semibold">Est. Current Growth</p>
          <p className="font-mono font-bold text-[#00d4aa] text-xl">+{formatUsd(currentGrowth)}</p>
        </div>
        <div className="rounded-2xl bg-[#111118] border border-[#1e1e2c] p-4 text-center group hover:border-[#a78bfa]/30 transition-all cursor-default">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a6a] mb-1 group-hover:text-[#a78bfa] transition-colors font-semibold">Saving / Year</p>
          <p className="font-mono font-bold text-[#a78bfa] text-xl">+{formatUsd(yearlySaved)}</p>
        </div>
      </div>

      {/* Deposit rows */}
      <div className="rounded-2xl border border-[#2a2a3a] overflow-hidden bg-[#111118]">
        {/* Desktop table */}
        <table className="w-full hidden md:table">
          <thead>
            <tr className="border-b border-[#1e1e2c]">
              <th className="text-left px-6 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Asset</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Balance</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Chain</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Vault</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Current APY</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#00d4aa]">Est. Yearly Yield</th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Action</th>
            </tr>
          </thead>
          <tbody>
            {validPositions.map((p, i) => {
              const vaultUrl = getVaultUrl(p.vault);
              const apy = getBestApy(p.vault);
              const yearlyYield = p.stakedTokenAmountUsd * apy;

              return (
                <tr
                  key={p.id}
                  className="border-b border-[#1e1e2c] last:border-0 hover:bg-[#22222e]/50 transition-colors"
                  style={{ animation: `rowEnter 300ms ease-out ${i * 50}ms both` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.vault.logoUrl || (p.vault as any).protocolLogoUrl ? (
                         <img 
                           src={(p.vault as any).protocolLogoUrl || p.vault.logoUrl} 
                           alt={p.vault.name} 
                           className="w-8 h-8 rounded-full border border-[#2a2a3a]" 
                         />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-[10px] font-bold">
                          {p.vault.protocol?.toString()?.slice(0, 2) || "De"}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#f0f0f5]">
                          {p.vault.name.includes("USDC") ? "USDC" : p.vault.name.includes("WETH") ? "WETH" : p.vault.asset.slice(0, 6) + "..."}
                        </p>
                        <p className="text-xs text-[#5a5a6a]">Yield Position</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-mono text-[#f0f0f5]">
                      {parseFloat(p.stakedTokenAmount).toFixed(4)}
                    </p>
                    <p className="text-xs text-[#5a5a6a]">{formatUsd(p.stakedTokenAmountUsd)}</p>
                    {p.txLink && (
                      <a 
                        href={p.txLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-[#00d4aa] hover:underline mt-1 block"
                      >
                        View Tx ↗
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#22222e] border border-[#2a2a3a] text-[#9898a8]">
                      {CHAIN_NAMES[p.chainId as keyof typeof CHAIN_NAMES] ?? p.chainId}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <a
                      href={vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#a78bfa] hover:text-white underline underline-offset-2 truncate max-w-[160px]"
                    >
                      {p.vault.name}
                      <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono font-bold text-[#00d4aa]">{formatApy(apy)}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono font-bold text-[#00d4aa]">
                      +{formatUsd(yearlyYield)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <a
                        href={vaultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#7c3aed] hover:text-[#a78bfa] font-semibold flex items-center gap-1"
                      >
                        Management ↗
                      </a>
                      <button
                        onClick={() => setSelectedWithdrawal(p)}
                        className="text-xs text-[#00d4aa] hover:text-[#00b492] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        Withdraw
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#1e1e2c]">
          {validPositions.map((p) => {
             const apy = getBestApy(p.vault);
             const vaultUrl = getVaultUrl(p.vault);
             return (
              <div key={p.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#f0f0f5]">{p.vault.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-[#00d4aa] text-sm">+{formatApy(apy)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-[#5a5a6a]">Balance</p>
                    <p className="font-mono text-[#f0f0f5]">{formatUsd(p.stakedTokenAmountUsd)}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a6a]">Chain</p>
                    <p className="text-[#f0f0f5]">{CHAIN_NAMES[p.chainId as keyof typeof CHAIN_NAMES] ?? p.chainId}</p>
                  </div>
                </div>
                  <div className="flex gap-2">
                    <a
                      href={vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 rounded-lg text-xs font-semibold text-[#7c3aed] border border-[#7c3aed]/30 hover:bg-[#7c3aed]/10 transition-colors"
                    >
                      Manage ↗
                    </a>
                    <button
                      onClick={() => setSelectedWithdrawal(p)}
                      className="flex-1 text-center py-2 rounded-lg text-xs font-semibold text-[#00d4aa] border border-[#00d4aa]/30 hover:bg-[#00d4aa]/10 transition-colors cursor-pointer"
                    >
                      Withdraw
                    </button>
                  </div>
              </div>
             );
          })}
        </div>

        {/* Totals footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a3a] bg-[#1a1a24]">
          <div className="flex items-center gap-2 text-sm text-[#5a5a6a]">
            <TrendingUp className="w-4 h-4 text-[#00d4aa]" />
            <span>Projected yearly yield</span>
          </div>
          <span className="font-mono font-black text-xl text-[#00d4aa]">+{formatUsd(yearlySaved)}</span>
        </div>
      </div>

      {/* Encouragement badge */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#5a5a6a]">
        <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
        <span>Your money is working. All positions are live on-chain.</span>
        <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
      </div>
      {selectedWithdrawal && (
        <WithdrawModal 
          position={selectedWithdrawal} 
          onClose={() => setSelectedWithdrawal(null)}
          onWithdrawn={() => {
            setSelectedWithdrawal(null);
            onWithdrawn?.();
          }}
        />
      )}
    </section>
  );
}
