import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, Info, Sparkles } from "lucide-react";
import type { DeadMoneyReport as Report, IdleAsset } from "~/lib/deadMoney";
import { formatUsd, formatApy, getScoreLabel } from "~/lib/deadMoney";
import { getVaultUrl } from "~/lib/earnApi";
import { CHAIN_NAMES } from "~/lib/tokens";
import { FixModal } from "./FixModal";
import { cn } from "~/lib/utils";

interface DeadMoneyReportProps {
  report: Report;
  onFixed: (asset: IdleAsset) => void;
  activePositions?: any[];
}

export function DeadMoneyReport({ report, onFixed, activePositions = [] }: DeadMoneyReportProps) {
  const [fixingAsset, setFixingAsset] = useState<IdleAsset | null>(null);
  const [fixedKeys, setFixedKeys] = useState<Set<string>>(new Set());
  const [animatedLoss, setAnimatedLoss] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const target = report.totalYearlyLossUsd;
    const duration = 1500;
    const startTime = performance.now();
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedLoss(easeOutExpo(progress) * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [report.totalYearlyLossUsd]);

  function handleFixed(asset: IdleAsset) {
    const key = `${asset.token.chainId}:${asset.token.address}`;
    setFixedKeys((prev) => new Set([...prev, key]));
    setFixingAsset(null);
    onFixed(asset);
  }

  const dailyLoss = report.totalDailyLossUsd;
  const avgApy = report.idleAssets.length > 0
    ? report.idleAssets.reduce((s, a) => s + a.bestApy, 0) / report.idleAssets.length
    : 0;
  const isHealthy = report.idleAssets.length === 0;

  const activeUsd = activePositions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0);
  const annualYield = activePositions.reduce(
    (s, p) => s + (p.stakedTokenAmountUsd ?? 0) * (p.vault?.apy ?? 0.05),
    0
  );

  return (
    <div
      className="w-full text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[1164px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-6">
        {/* Hero card */}
        {isHealthy ? (
          <section
            className="relative rounded-[12px] overflow-hidden px-6 py-10 sm:py-14 flex flex-col items-center gap-6 sm:gap-8 backdrop-blur-xl"
            style={{
              backgroundImage:
                "linear-gradient(91deg, rgba(2,9,6,0.6) 0%, rgba(6,70,58,0.6) 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,168,136,0.25) 0%, rgba(2,3,19,0) 70%)",
              }}
            />
            <div className="relative z-10 text-5xl">✨</div>
            <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 text-center">
              <p className="text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.48px] text-white">
                Your Money Is Working
              </p>
              <p
                className="text-[#00a888] font-medium leading-none"
                style={{ fontSize: "clamp(36px, 6vw, 64px)" }}
              >
                No Dead Money Detected
              </p>
            </div>
            <p className="relative z-10 max-w-[760px] text-center text-[16px] sm:text-[20px] leading-snug">
              All actionable assets are already earning yield.{" "}
              <span className="font-bold text-[#00a888]">Nice work.</span>
            </p>
          </section>
        ) : (
          <section
            className="relative rounded-[12px] overflow-hidden px-6 py-10 sm:py-14 flex flex-col items-center gap-6 sm:gap-8 backdrop-blur-xl"
            style={{
              backgroundImage:
                "linear-gradient(91deg, rgba(72,0,0,0.4) 0%, rgba(36,2,2,0.4) 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(228,0,0,0.25) 0%, rgba(2,3,19,0) 70%)",
              }}
            />
            <div className="relative z-10 w-11 h-11">
              <img src="/logo-icon.svg" alt="" className="w-full h-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 text-center">
              <p className="text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.48px] text-white">
                Estimated Yearly Loss From Idle Assets
              </p>
              <p
                className="text-[#e40000] font-medium leading-none"
                style={{ fontSize: "clamp(56px, 10vw, 96px)" }}
              >
                -{formatUsd(animatedLoss, true)}
              </p>
            </div>

            <p className="relative z-10 max-w-[760px] text-center text-[16px] sm:text-[20px] leading-snug">
              Your assets are bleeding{" "}
              <span className="font-bold text-[#e40000] text-2xl">
                {formatUsd(animatedLoss, true)}/year
              </span> {" "}
              by sitting idle instead of earning yield
            </p>

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 w-full max-w-[640px] text-center">
              <HeroStat label="Idle Assets" value={formatUsd(report.totalIdleUsd)} border />
              <HeroStat label="Idle Since" value="90 Days" border />
              <HeroStat label="Best Available APY" value={formatApy(avgApy)} valueClass="text-[#00a888]" />
            </div>
          </section>
        )}

        {/* Score + Active yield row */}
        <div className="grid grid-cols-1 lg:grid-cols-[296px_1fr] gap-6">
          <ScoreCard score={report.deadMoneyScore} />
          <ActiveYieldCard activeUsd={activeUsd} annualYield={annualYield} hasActive={activePositions.length > 0} />
        </div>

        {/* Idle assets table */}
        {!isHealthy && (
        <div className="rounded-[12px] border border-[#373737] bg-[rgba(14,11,20,0.67)] overflow-hidden">
          {/* Info banner */}
          <div className="flex gap-3 items-center bg-[rgba(29,72,229,0.14)] px-4 py-4 border-b border-[#1d48e533]">
            <Info className="w-5 h-5 text-[#6aa5ff] shrink-0" />
            <p className="text-[13px] sm:text-[14px] text-[#eaeaea] leading-snug">
              Hit Fix This on any row to start earning. Audited vaults, no lockups, withdraw anytime.
            </p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:grid bg-[#1a1a24] border-b border-[#464646] px-4 py-5 gap-4 items-center text-[12px] font-medium uppercase tracking-[0.56px] text-[#cacaca]"
               style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr 1fr 1fr" }}>
            <span>Token</span>
            <span>Idle Amount</span>
            <span>Chain</span>
            <span>Best Vault</span>
            <span>Best APY</span>
            <span>Est. Yearly Loss</span>
            <span className="text-right">Action</span>
          </div>

          {/* Rows */}
          {report.idleAssets.map((asset, i) => {
            const key = `${asset.token.chainId}:${asset.token.address}`;
            const isFixed = fixedKeys.has(key);
            return (
              <div
                key={key}
                className="border-t border-[#262626]"
                style={{ animation: `rowEnter 300ms ease-out ${i * 60}ms both` }}
              >
                {/* Desktop row */}
                <div
                  className={cn(
                    "hidden lg:grid px-4 py-4 gap-4 items-center transition-colors",
                    isFixed ? "opacity-50" : "hover:bg-[#1a1a24]/60"
                  )}
                  style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr 1fr 1fr" }}
                >
                  <div className="flex items-center gap-3">
                    <TokenLogo src={asset.token.logoUrl} symbol={asset.token.symbol} />
                    <div className="flex flex-col gap-1">
                      <p className="text-[16px] font-medium text-[#eaeaea] uppercase tracking-[0.64px]">{asset.token.symbol}</p>
                      <p className="text-[12px] text-[#e9e9e9] tracking-[0.48px] capitalize">{asset.token.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[16px] font-medium text-[#eaeaea] tracking-[0.64px]">
                      {asset.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </p>
                    <p className="text-[12px] text-[#e9e9e9] tracking-[0.48px]">{formatUsd(asset.usdValue)}</p>
                  </div>
                  <div>
                    <span className="inline-flex bg-[#272727] px-2 py-1.5 text-[13px] font-medium text-[#e9e9e9] tracking-[0.56px] uppercase">
                      {CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES] ?? asset.token.chainId}
                    </span>
                  </div>
                  <div>
                    {asset.bestVault ? (
                      <a
                        href={getVaultUrl(asset.bestVault)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[15px] font-medium text-[#0086fb] tracking-[0.64px] uppercase truncate hover:underline"
                      >
                        <span className="truncate max-w-[140px]">{asset.bestVault.name}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-[#5a5a6a]">No vault</span>
                    )}
                  </div>
                  <p className="text-[16px] font-medium text-[#01c39e] tracking-[0.64px] uppercase">
                    {asset.bestApy > 0 ? formatApy(asset.bestApy) : "—"}
                  </p>
                  <p className="text-[16px] font-medium text-[#e40000] tracking-[0.64px] uppercase">
                    -{formatUsd(asset.yearlyLossUsd)}
                  </p>
                  <div className="flex justify-end">
                    {isFixed ? (
                      <span className="text-[12px] text-[#01c39e] font-bold">✓ Earning {formatApy(asset.bestApy)}</span>
                    ) : asset.bestVault ? (
                      <button
                        onClick={() => setFixingAsset(asset)}
                        className="bg-[rgba(201,243,82,0.09)] hover:bg-[rgba(201,243,82,0.18)] rounded-[4px] px-5 py-2.5 text-[12px] font-bold text-[#c9f352] transition-colors"
                      >
                        Fix This
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Mobile / tablet card */}
                <div className={cn("lg:hidden p-4 flex flex-col gap-3", isFixed && "opacity-50")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TokenLogo src={asset.token.logoUrl} symbol={asset.token.symbol} />
                      <div>
                        <p className="text-[16px] font-medium uppercase tracking-[0.64px] text-[#eaeaea]">{asset.token.symbol}</p>
                        <p className="text-[12px] text-[#e9e9e9] capitalize">{asset.token.name}</p>
                      </div>
                    </div>
                    <span className="bg-[#272727] px-2 py-1 text-[12px] font-medium uppercase text-[#e9e9e9] tracking-[0.48px]">
                      {CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES] ?? asset.token.chainId}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <Cell label="Idle" value={formatUsd(asset.usdValue)} />
                    <Cell label="Best APY" value={asset.bestApy > 0 ? formatApy(asset.bestApy) : "—"} valueClass="text-[#01c39e]" />
                    <Cell label="Yearly Loss" value={`-${formatUsd(asset.yearlyLossUsd)}`} valueClass="text-[#e40000]" />
                    {asset.bestVault && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-[#9c9c9c]">Vault</p>
                        <a href={getVaultUrl(asset.bestVault)} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#0086fb] underline truncate inline-block max-w-[140px]">
                          {asset.bestVault.name}
                        </a>
                      </div>
                    )}
                  </div>
                  {!isFixed && asset.bestVault && (
                    <button
                      onClick={() => setFixingAsset(asset)}
                      className="w-full bg-[rgba(201,243,82,0.09)] hover:bg-[rgba(201,243,82,0.18)] rounded-[4px] py-2.5 text-[13px] font-bold text-[#c9f352] transition-colors"
                    >
                      Fix This
                    </button>
                  )}
                  {isFixed && (
                    <p className="text-center text-xs text-[#01c39e]">✓ Earning {formatApy(asset.bestApy)} APY</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-[#1a1a24] px-4 py-6 border-t border-[#262626]">
            <p className="text-[16px] sm:text-[20px] text-[#eaeaea] tracking-[0.8px] capitalize">
              Total Estimated Yearly Loss
            </p>
            <p className="text-[20px] sm:text-[24px] font-medium text-[#e40000] tracking-[0.96px] uppercase">
              -{formatUsd(report.totalYearlyLossUsd)}
            </p>
          </div>
        </div>
        )}
      </div>

      {fixingAsset && (
        <FixModal
          asset={fixingAsset}
          onClose={() => setFixingAsset(null)}
          onFixed={() => handleFixed(fixingAsset)}
        />
      )}
    </div>
  );
}

function TokenLogo({ src, symbol }: { src?: string; symbol: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-10 h-10 rounded-full bg-[#272727] border border-[#3a3a3a] flex items-center justify-center text-[11px] font-bold text-[#cacaca] shrink-0">
        {symbol.slice(0, 3)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={symbol}
      className="w-10 h-10 rounded-full border border-[#2a2a3a] shrink-0 bg-[#0e0e0e]"
      onError={() => setErr(true)}
    />
  );
}

function HeroStat({ label, value, valueClass, border }: { label: string; value: string; valueClass?: string; border?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-4 sm:px-6 py-2",
        border && "sm:border-r sm:border-[rgba(255,255,255,0.24)]"
      )}
    >
      <p className="text-[13px] sm:text-[14px] text-white uppercase tracking-[0.56px] font-medium">{label}</p>
      <p className={cn("text-[22px] sm:text-[24px] font-medium", valueClass ?? "text-white")}>{value}</p>
    </div>
  );
}

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[#9c9c9c]">{label}</p>
      <p className={cn("text-[14px] font-medium", valueClass ?? "text-[#eaeaea]")}>{value}</p>
    </div>
  );
}

function ScoreCard({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const info = getScoreLabel(score);

  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    function tick(now: number) {
      const p = Math.min((now - startTime) / duration, 1);
      setAnimatedScore(Math.round(ease(p) * score));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [score]);

  return (
    <div className="rounded-[12px] bg-[#0e0b14] backdrop-blur-xl px-6 py-6 flex flex-col items-center gap-6">
      <p className="text-[14px] font-medium text-white tracking-[0.56px] uppercase text-center">Dead Money Score</p>

      <div className="relative w-full flex justify-center">
        <svg viewBox="0 0 220 120" className="w-[220px] max-w-full">
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF2D2D" />
              <stop offset="33%" stopColor="#FF6B35" />
              <stop offset="66%" stopColor="#F5C518" />
              <stop offset="100%" stopColor="#00D4AA" />
            </linearGradient>
          </defs>
          <path d="M 15 110 A 95 95 0 0 1 205 110" stroke="#22222e" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path
            d="M 15 110 A 95 95 0 0 1 205 110"
            stroke="url(#scoreGrad)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 95}`}
            strokeDashoffset={Math.PI * 95 - (animatedScore / 100) * Math.PI * 95}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
        <div className="absolute bottom-0 text-center">
          <span className="text-[28px] font-normal text-white">{animatedScore}</span>
          <span className="text-[#aeaeae] text-[20px]">/100</span>
        </div>
      </div>

      <span
        className="inline-flex px-4 py-2 rounded-[4px] text-[11px] font-bold tracking-[0.84px] uppercase text-center"
        style={{ backgroundColor: `${info.color}26`, color: info.color }}
      >
        {info.label} — High Dead Money
      </span>
      <p className="text-[12px] text-white text-center">100 = Every dollar working. 0 = Financial Coma</p>
    </div>
  );
}

function ActiveYieldCard({ activeUsd, annualYield, hasActive }: { activeUsd: number; annualYield: number; hasActive: boolean }) {
  return (
    <div
      className="relative rounded-[12px] overflow-hidden px-6 sm:px-8 py-6 flex flex-col gap-6 backdrop-blur-xl"
      style={{
        backgroundImage:
          "linear-gradient(111deg, rgba(2,9,6,0.9) 0%, rgba(6,70,58,0.9) 98%)",
      }}
    >
      <div
        aria-hidden
        className="absolute right-0 top-0 w-[280px] h-[280px] pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(0,168,136,0.35) 0%, transparent 70%)",
        }}
      />
      <Sparkles
        aria-hidden
        className="absolute right-4 top-4 w-40 h-40 sm:w-56 sm:h-56 text-[#00a888] opacity-15 pointer-events-none"
        strokeWidth={1}
      />
      <p className="relative z-10 text-[20px] sm:text-[24px] font-medium text-white">
        {hasActive ? "Your Money Is Working!" : "How to rescue your dead money"}
      </p>

      <div className="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-14">
        <div className="flex flex-col gap-3 sm:border-r sm:border-[rgba(255,255,255,0.24)] sm:pr-14">
          <p className="text-[13px] sm:text-[14px] font-medium text-white tracking-[0.56px] uppercase">Active Investments</p>
          <p className="text-[32px] sm:text-[40px] font-medium text-white leading-none">{formatUsd(activeUsd)}</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[13px] sm:text-[14px] font-medium text-white tracking-[0.56px] uppercase">Annual Yield</p>
          <p className="text-[32px] sm:text-[40px] font-medium text-[#00a888] leading-none">+{formatUsd(annualYield)}</p>
        </div>
      </div>

      <p className="relative z-10 text-[14px] sm:text-[16px] text-white max-w-[585px] leading-relaxed">
        {hasActive
          ? "You're already saving thousands by keeping these assets in yield-bearing vaults."
          : "Click Fix This on any row to deposit idle assets into the best available vault. Your funds are withdrawable anytime — no lockups."}
      </p>

      {hasActive && (
        <div className="relative z-10">
          <button
            onClick={() => { const el = document.getElementById("my-deposits"); el?.scrollIntoView({ behavior: "smooth" }); }}
            className="inline-flex items-center gap-2 bg-[rgba(3,59,48,0.5)] hover:bg-[rgba(3,59,48,0.75)] rounded-[4px] px-5 py-2.5 text-[12px] font-bold text-[#00a888] transition-colors"
          >
            Manage Positions
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
