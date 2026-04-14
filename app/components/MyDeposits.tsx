import { useMemo, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
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
  variant?: "scan" | "deposits";
  refreshing?: boolean;
  showBottomWorkingMessage?: boolean;
}

export function MyDeposits({
  positions,
  walletAddress,
  onWithdrawn,
  variant = "scan",
  refreshing = false,
  showBottomWorkingMessage = true,
}: MyDepositsProps) {
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Position | null>(null);
  const yearlySaved = useMemo(() => calculateYearlyYield(positions), [positions]);

  const validPositions = useMemo(() => positions.filter(p => !!p.vault), [positions]);
  const totalDeposited = useMemo(
    () => validPositions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0),
    [validPositions]
  );
  const currentGrowth = useMemo(() => estimateTotalGrowth(validPositions), [validPositions]);

  if (validPositions.length === 0) return null;

  return (
    <section
      id="my-deposits"
      className="w-full text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="flex flex-col items-center gap-6">
        {variant === "scan" ? null : (
          /* Left-aligned header strip — matches deposits-page Figma */
          <div className="w-full rounded-[12px] bg-[rgba(14,11,20,0.67)] backdrop-blur-[37.65px] p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="rounded-full p-2.5 shrink-0"
                style={{
                  backgroundImage:
                    "linear-gradient(97.56deg, rgba(2, 9, 6, 0.9) 0%, rgba(0, 41, 33, 0.396) 98.22%)",
                }}
              >
                <Sparkles className="w-8 h-8 text-[#00a888]" strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <h2 className="text-[24px] sm:text-[32px] font-medium text-[#faf6f6] leading-none truncate">
                  My Deposits
                </h2>
                <p className="text-[#cacaca] text-[13px] sm:text-[14px]">
                  On-chain yield-bearing assets
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 bg-[rgba(16,185,129,0.13)] rounded-[4px] px-4 py-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a888] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a888]" />
              </span>
              <p className="text-[12px] font-bold text-[#00a888] tracking-[0.84px] uppercase whitespace-nowrap">
                {validPositions.length} active
              </p>
            </div>
          </div>
        )}

        <div className={variant === "scan" ? "w-full grid grid-cols-1 lg:grid-cols-[372px_1fr] gap-6 items-start" : "w-full"}>
        {variant === "scan" && (
          /* Side summary card — matches new scan-page Figma */
          <div
            className="rounded-[12px] backdrop-blur-[37.65px] px-6 py-10 flex flex-col items-center justify-center gap-9"
            style={{
              backgroundImage:
                "linear-gradient(96.84deg, rgba(2, 9, 6, 0.9) 0%, rgba(0, 41, 33, 0.396) 98.22%)",
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center text-[#faf6f6]">
              <h2 className="text-[28px] sm:text-[32px] font-medium leading-none">My Deposits</h2>
              <p className="text-[16px] sm:text-[20px] text-[#faf6f6] whitespace-nowrap">On-chain yield-bearing assets</p>
            </div>

            <div className="inline-flex items-center gap-2.5 bg-[rgba(16,185,129,0.13)] rounded-[4px] px-4 py-2">
              <span className="relative flex h-[9px] w-[9px]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a888] opacity-75" />
                <span className="relative inline-flex h-[9px] w-[9px] rounded-full bg-[#00a888]" />
              </span>
              <p className="text-[12px] font-bold text-[#00a888] tracking-[0.84px] uppercase whitespace-nowrap">
                {validPositions.length} active
              </p>
            </div>

            <div className="flex items-stretch text-center w-full">
              <div className="flex-1 flex flex-col items-center gap-4 px-2 border-r border-white">
                <p className="text-[13px] sm:text-[14px] text-[#cacaca] uppercase tracking-[0.56px] font-medium whitespace-nowrap">
                  Total Deposit
                </p>
                <p className="text-[26px] sm:text-[32px] font-medium text-white leading-none">
                  {formatUsd(totalDeposited)}
                </p>
              </div>
              <div className="flex-1 flex flex-col items-center gap-4 px-2">
                <p className="text-[13px] sm:text-[14px] text-[#cacaca] uppercase tracking-[0.56px] font-medium whitespace-nowrap">
                  Saving / Year
                </p>
                <p className="text-[26px] sm:text-[32px] font-medium text-white leading-none">
                  +{formatUsd(yearlySaved)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 text-center w-full">
              <p className="text-[13px] sm:text-[14px] text-[#cacaca] uppercase tracking-[0.56px] font-medium">
                Est. Current Growth
              </p>
              <p className="text-[28px] sm:text-[32px] font-medium text-[#00a888] leading-none">
                +{formatUsd(currentGrowth)}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="w-full min-w-0 rounded-[12px] border border-[#373737] bg-[rgba(14,11,20,0.67)] overflow-hidden relative">
          {refreshing && (
            <div className="absolute inset-0 z-20 bg-[rgba(14,11,20,0.55)] backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(14,11,20,0.85)] ring-1 ring-[#c9f352]/30">
                <span className="w-2 h-2 rounded-full bg-[#c9f352] animate-pulse" />
                <span className="text-[12px] font-medium text-white tracking-[0.4px] uppercase">Fetching latest positions…</span>
              </div>
            </div>
          )}
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
                className={`border-t border-[#262626] ${refreshing ? "animate-pulse opacity-60" : ""}`}
                style={!refreshing ? { animation: `rowEnter 300ms ease-out ${i * 50}ms both` } : undefined}
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
          <div className="flex flex-wrap gap-3 items-center bg-[#1a1a24] px-4 py-6 border-t border-[#373737]">
            <ArrowUpRight className="w-6 h-6 text-[#14c75c] shrink-0" />
            <p className="flex-1 min-w-0 text-[16px] sm:text-[20px] text-[#faf6f6] tracking-[0.8px] capitalize">
              Projected Yearly Yield
            </p>
            <p className="text-[20px] sm:text-[24px] font-medium text-[#14c75c] tracking-[0.96px] uppercase">
              +{formatUsd(yearlySaved)}
            </p>
          </div>
        </div>
        </div>

        {showBottomWorkingMessage && (
          <p className="text-[14px] text-[#cfcfcf] text-center">
            Your Money Is Working! All Positions are live on-chain
          </p>
        )}
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

function DepositStat({
  label,
  value,
  valueClass,
  border,
}: {
  label: string;
  value: string;
  valueClass?: string;
  border?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-3 sm:gap-4 px-6 min-w-[160px] sm:min-w-[186px] " +
        (border ? "sm:border-r sm:border-white" : "")
      }
    >
      <p className="text-[13px] sm:text-[14px] text-[#cacaca] uppercase tracking-[0.56px] font-medium">
        {label}
      </p>
      <p className={"text-[26px] sm:text-[32px] font-medium leading-none " + (valueClass ?? "text-white")}>
        {value}
      </p>
    </div>
  );
}
