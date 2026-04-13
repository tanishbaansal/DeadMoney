import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Position } from "~/lib/earnApi";
import { getBestApy, getVaultUrl } from "~/lib/earnApi";
import { calculateYearlyYield, estimateTotalGrowth } from "~/lib/deposits";
import { formatApy, formatUsd } from "~/lib/deadMoney";
import { CHAIN_NAMES } from "~/lib/tokens";
import { WithdrawModal } from "./WithdrawModal";
import { cn } from "~/lib/utils";

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
    <section
      id="my-deposits"
      className="w-full text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="space-y-6">
        {/* Header card */}
        <div className="rounded-[12px] bg-[rgba(14,11,20,0.67)] backdrop-blur-xl px-6 py-10 flex flex-col items-center gap-9">
          <div className="flex flex-col items-center gap-3 text-center text-[#eaeaea]">
            <h2 className="text-[28px] sm:text-[32px] font-medium">My Deposits</h2>
            <p className="text-[16px] sm:text-[20px]">On-chain yield-bearing assets</p>
          </div>

          <div className="inline-flex items-center gap-2 bg-[rgba(16,185,129,0.13)] rounded-[4px] px-4 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a888] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a888]" />
            </span>
            <p className="text-[12px] font-bold text-[#00a888] tracking-[0.84px] uppercase">{validPositions.length} active</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 w-full max-w-[780px] text-center">
            <SummaryStat label="Total Deposit" value={formatUsd(totalDeposited)} border />
            <SummaryStat label="Saving / Year" value={`+${formatUsd(yearlySaved)}`} border />
            <SummaryStat label="Est. Current Growth" value={`+${formatUsd(currentGrowth)}`} valueClass="text-[#00a888]" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[12px] border border-[#373737] bg-[rgba(12,12,13,0.84)] overflow-hidden">
          {/* Desktop header */}
          <div
            className="hidden lg:grid bg-[#1a1a24] px-4 py-5 gap-4 items-center text-[12px] font-medium uppercase tracking-[0.56px] text-[#cacaca]"
            style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 1.2fr 0.8fr 1fr 1.4fr" }}
          >
            <span>Asset</span>
            <span>Balance</span>
            <span>Chain</span>
            <span>Vault</span>
            <span>Current APY</span>
            <span>Est. Yearly Yield</span>
            <span className="text-center">Action</span>
          </div>

          {validPositions.map((p, i) => {
            const apy = getBestApy(p.vault);
            const vaultUrl = getVaultUrl(p.vault);
            const yearlyYield = (p.stakedTokenAmountUsd ?? 0) * apy;
            const symbol = p.vault.name.includes("USDC")
              ? "USDC"
              : p.vault.name.includes("WETH")
                ? "WETH"
                : (p.vault.asset?.slice(0, 6) ?? "TOKEN");
            const logo = (p.vault as any).protocolLogoUrl || p.vault.logoUrl;

            return (
              <div
                key={p.id}
                className="border-t border-[#262626]"
                style={{ animation: `rowEnter 300ms ease-out ${i * 50}ms both` }}
              >
                {/* Desktop row */}
                <div
                  className="hidden lg:grid px-4 py-4 gap-4 items-center hover:bg-[#1a1a24]/60 transition-colors"
                  style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 1.2fr 0.8fr 1fr 1.4fr" }}
                >
                  <div className="flex items-center gap-2">
                    {logo ? (
                      <img src={logo} alt={p.vault.name} className="w-[42px] h-[42px] rounded-full border border-[#2a2a3a]" />
                    ) : (
                      <div className="w-[42px] h-[42px] rounded-full bg-[#272727] flex items-center justify-center text-[10px] font-bold">
                        {p.vault.protocol?.toString()?.slice(0, 2) || "DM"}
                      </div>
                    )}
                    <div>
                      <p className="text-[16px] font-medium text-white uppercase tracking-[0.64px]">{symbol}</p>
                      <p className="text-[12px] text-[#b7b7b7] capitalize tracking-[0.48px]">USD Coin</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-[16px] font-medium text-white uppercase tracking-[0.64px]">
                      {parseFloat(p.stakedTokenAmount).toFixed(4)}
                    </p>
                    <p className="text-[12px] text-[#b7b7b7] tracking-[0.48px]">{formatUsd(p.stakedTokenAmountUsd ?? 0)}</p>
                    {p.txLink && (
                      <a
                        href={p.txLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-[#c9f352] font-bold mt-0.5 hover:underline"
                      >
                        View Tx <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div>
                    <span className="inline-flex bg-[#272727] px-2 py-1.5 text-[13px] font-medium text-[#cecece] uppercase tracking-[0.56px]">
                      {CHAIN_NAMES[p.chainId as keyof typeof CHAIN_NAMES] ?? p.chainId}
                    </span>
                  </div>

                  <a
                    href={vaultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[15px] font-medium text-[#0086fb] uppercase tracking-[0.64px] underline hover:text-white truncate"
                  >
                    <span className="truncate max-w-[140px]">{p.vault.name}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  </a>

                  <p className="text-[16px] font-medium text-[#14c75c] uppercase tracking-[0.64px]">{formatApy(apy)}</p>

                  <p className="text-[16px] font-medium text-[#14c75c] uppercase tracking-[0.64px]">+{formatUsd(yearlyYield)}</p>

                  <div className="flex items-center justify-end gap-2.5">
                    <a
                      href={vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[4px] px-5 py-2.5 text-[12px] font-bold text-[#c9f352] hover:bg-[rgba(201,243,82,0.08)] transition-colors"
                    >
                      Manage
                    </a>
                    <button
                      onClick={() => setSelectedWithdrawal(p)}
                      className="bg-[rgba(201,243,82,0.08)] hover:bg-[rgba(201,243,82,0.18)] rounded-[4px] px-5 py-2.5 text-[12px] font-bold text-[#c9f352] transition-colors"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                {/* Mobile / tablet */}
                <div className="lg:hidden p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <img src={logo} alt={p.vault.name} className="w-10 h-10 rounded-full border border-[#2a2a3a]" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#272727]" />
                    )}
                    <div className="flex-1">
                      <p className="text-[15px] font-medium uppercase tracking-[0.64px]">{symbol}</p>
                      <p className="text-[12px] text-[#b7b7b7]">{formatUsd(p.stakedTokenAmountUsd ?? 0)}</p>
                    </div>
                    <span className="bg-[#272727] px-2 py-1 text-[12px] uppercase text-[#cecece] tracking-[0.48px]">
                      {CHAIN_NAMES[p.chainId as keyof typeof CHAIN_NAMES] ?? p.chainId}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#9c9c9c]">APY</p>
                      <p className="text-[14px] font-medium text-[#14c75c]">{formatApy(apy)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#9c9c9c]">Yearly Yield</p>
                      <p className="text-[14px] font-medium text-[#14c75c]">+{formatUsd(yearlyYield)}</p>
                    </div>
                  </div>
                  <a
                    href={vaultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[#0086fb] font-medium uppercase truncate inline-flex items-center gap-1"
                  >
                    {p.vault.name} <ArrowUpRight className="w-3 h-3" />
                  </a>
                  <div className="flex gap-2">
                    <a
                      href={vaultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 rounded-[4px] text-[13px] font-bold text-[#c9f352] border border-[#c9f352]/30 hover:bg-[rgba(201,243,82,0.08)]"
                    >
                      Manage
                    </a>
                    <button
                      onClick={() => setSelectedWithdrawal(p)}
                      className="flex-1 text-center py-2 rounded-[4px] text-[13px] font-bold text-[#c9f352] bg-[rgba(201,243,82,0.08)] hover:bg-[rgba(201,243,82,0.18)]"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="flex flex-wrap gap-3 items-center justify-between bg-[#1a1a24] px-4 py-6 border-t border-[#262626]">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="w-6 h-6 text-[#00a353]" />
              <p className="text-[16px] sm:text-[20px] text-[#eaeaea] tracking-[0.8px] capitalize">
                Projected Yearly Yield
              </p>
            </div>
            <p className="text-[20px] sm:text-[24px] font-medium text-[#00a353] tracking-[0.96px] uppercase">
              +{formatUsd(yearlySaved)}
            </p>
          </div>
        </div>

        <p className="text-[14px] text-[#cfcfcf] text-center">
          Your Money Is Working! All Positions are live on-chain
        </p>
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

function SummaryStat({ label, value, valueClass, border }: { label: string; value: string; valueClass?: string; border?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-2",
        border && "sm:border-r sm:border-[rgba(255,255,255,0.24)]"
      )}
    >
      <p className="text-[13px] sm:text-[14px] text-[#9c9c9c] uppercase tracking-[0.56px] font-medium">{label}</p>
      <p className={cn("text-[26px] sm:text-[32px] font-medium leading-none", valueClass ?? "text-white")}>{value}</p>
    </div>
  );
}
