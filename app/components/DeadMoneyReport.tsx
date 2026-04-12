import { useState, useEffect, useRef } from "react";
import { Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import type { DeadMoneyReport as Report, IdleAsset } from "~/lib/deadMoney";
import { formatUsd, formatApy, getScoreLabel } from "~/lib/deadMoney";
import { getVaultUrl } from "~/lib/earnApi";
import { shortenAddress as shorten } from "~/lib/ens";
import { CHAIN_NAMES } from "~/lib/tokens";
import { ShareButton } from "./ShareButton";
import { ShareCard } from "./ShareCard";
import { FixModal } from "./FixModal";
import { cn } from "~/lib/utils";

interface DeadMoneyReportProps {
  report: Report;
  onFixed: (asset: IdleAsset) => void;
  activePositions?: any[];
}

export function DeadMoneyReport({ report, onFixed, activePositions = [] }: DeadMoneyReportProps) {
  const [copied, setCopied] = useState(false);
  const [fixingAsset, setFixingAsset] = useState<IdleAsset | null>(null);
  const [fixedKeys, setFixedKeys] = useState<Set<string>>(new Set());
  const [animatedLoss, setAnimatedLoss] = useState(0);
  const hasAnimated = useRef(false);

  // Count-up animation for hero number
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const target = report.totalYearlyLossUsd;
    const duration = 1500;
    const startTime = performance.now();

    function easeOutExpo(t: number) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedLoss(easeOutExpo(progress) * target);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [report.totalYearlyLossUsd]);

  function copyAddress() {
    navigator.clipboard.writeText(report.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFixed(asset: IdleAsset) {
    const key = `${asset.token.chainId}:${asset.token.address}`;
    setFixedKeys((prev) => new Set([...prev, key]));
    setFixingAsset(null);
    onFixed(asset);
  }

  const scoreInfo = getScoreLabel(report.deadMoneyScore);
  const dailyLoss = report.totalDailyLossUsd;
  const avgApy = report.idleAssets.length > 0
    ? report.idleAssets.reduce((s, a) => s + a.bestApy, 0) / report.idleAssets.length
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Wallet header */}
        <div className="flex items-center justify-between py-4 border-b border-[#1e1e2c] mb-2">
          <button
            onClick={copyAddress}
            className="cursor-pointer flex items-center gap-2 font-mono text-sm text-[#9898a8] hover:text-[#f0f0f5] transition-colors"
          >
            <span>{shorten(report.address)}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[#00d4aa]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#22222e] border border-[#2a2a3a] text-[#9898a8]">
              {report.idleAssets.length} idle assets
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full border border-[#2a2a3a] text-[#9898a8]">
              Just now
            </span>
          </div>
        </div>

        {/* Hero loss number */}
        <section className="text-center py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(255,45,45,0.1),transparent)] pointer-events-none" />

          <p className="text-xs font-medium tracking-widest uppercase text-[#5a5a6a] mb-4">
            Estimated Yearly Loss From Idle Assets
          </p>

          <h1
            className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-[#ff2d2d] text-glow-red financial relative z-10"
          >
            -{formatUsd(animatedLoss)}
          </h1>

          <p className="text-[#9898a8] text-lg mt-4 relative z-10">
            Your assets are{" "}
            <span className="text-[#ff2d2d] font-semibold">
              bleeding {formatUsd(dailyLoss, true)}/day
            </span>{" "}
            by sitting idle instead of earning yield.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-8 text-sm relative z-10">
            <StatItem label="Idle Assets" value={formatUsd(report.totalIdleUsd)} />
            <div className="hidden sm:block w-px h-8 bg-[#2a2a3a]" />
            <StatItem label="Idle Since" value="~90 days avg" />
            <div className="hidden sm:block w-px h-8 bg-[#2a2a3a]" />
            <StatItem label="Best Available APY" value={formatApy(avgApy)} valueClass="text-[#00d4aa]" />
          </div>
        </section>

        {/* Score & Active Yield */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1 flex justify-center">
            <ScoreGauge score={report.deadMoneyScore} />
          </div>
          
          <div className="lg:col-span-2 flex flex-col justify-center gap-6">
            {activePositions.length > 0 ? (
              <div className="rounded-3xl bg-[#00d4aa]/5 border border-[#00d4aa]/20 p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-[#00d4aa]/10 to-transparent opacity-50" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-[#00d4aa]" />
                    <h2 className="text-xl font-bold text-[#f0f0f5]">Your money is working!</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#5a5a6a] mb-1">Active Investments</p>
                      <p className="text-3xl font-black text-[#f0f0f5] font-mono">
                        {formatUsd(activePositions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#5a5a6a] mb-1">Annual Yield</p>
                      <p className="text-3xl font-black text-[#00d4aa] font-mono">
                        +{formatUsd(activePositions.reduce((s, p) => s + (p.stakedTokenAmountUsd * (p.vault?.apy ?? 0.05)), 0))}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[#9898a8] mt-6 leading-relaxed">
                    You're already saving thousands by keeping these assets in yield-bearing vaults. 
                    <span className="text-white font-medium"> Scroll down to manage your positions.</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-center gap-4">
                <h2 className="text-xl font-semibold text-[#f0f0f5]">
                  How to rescue your dead money
                </h2>
                <p className="text-[#9898a8] text-sm leading-relaxed">
                  Click <span className="text-[#a78bfa] font-medium">Fix This</span> on any row below to deposit idle assets
                  into the best available vault via LI.FI Composer.
                  Your funds are withdrawable anytime — no lockups.
                </p>
                <div className="flex gap-3 flex-wrap">
                  {report.idleAssets.slice(0, 3).map((a) => (
                    <span
                      key={`${a.token.chainId}:${a.token.address}`}
                      className="text-xs px-2.5 py-1 rounded-full bg-[#ff2d2d]/10 border border-[#ff2d2d]/20 text-[#ff2d2d]"
                    >
                      {a.token.symbol} bleeding {formatUsd(a.dailyLossUsd, true)}/day
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table — Desktop */}
        <div className="hidden md:block rounded-2xl border border-[#2a2a3a] overflow-hidden bg-[#111118] mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2c]">
                <th className="text-left px-6 py-4 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Token</th>
                <th className="text-right px-4 py-4 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Idle Amount</th>
                <th className="text-center px-4 py-4 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Chain</th>
                <th className="text-left px-4 py-4 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Best Vault</th>
                <th className="text-right px-4 py-4 text-xs font-medium uppercase tracking-wider text-[#5a5a6a]">Best APY</th>
                <th className="text-right px-4 py-4 text-xs font-medium uppercase tracking-wider text-[#ff2d2d]">Est. Yearly Loss</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {report.idleAssets.map((asset, i) => {
                const key = `${asset.token.chainId}:${asset.token.address}`;
                const isFixed = fixedKeys.has(key);
                const isTop = i === 0;
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-[#1e1e2c] last:border-0 group transition-colors",
                      isFixed ? "opacity-50" : "hover:bg-[#22222e]/50",
                      isTop && !isFixed && "bg-[#ff2d2d]/5"
                    )}
                    style={{ animation: `rowEnter 300ms ease-out ${i * 60}ms both` }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={asset.token.logoUrl}
                          alt={asset.token.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div>
                          <p className="font-semibold text-[#f0f0f5]">{asset.token.symbol}</p>
                          <p className="text-xs text-[#5a5a6a]">{asset.token.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-mono font-medium text-[#f0f0f5]">
                        {asset.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </p>
                      <p className="text-xs text-[#5a5a6a]">{formatUsd(asset.usdValue)}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#22222e] border border-[#2a2a3a] text-[#9898a8]">
                        {CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES] ?? asset.token.chainId}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {asset.bestVault ? (
                        <a
                          href={getVaultUrl(asset.bestVault)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#a78bfa] hover:text-white truncate max-w-[140px] underline underline-offset-2 cursor-pointer inline-flex items-center gap-1"
                        >
                          {asset.bestVault.name}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-xs text-[#5a5a6a]">No vault found</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-mono font-bold text-[#00d4aa]">
                        {asset.bestApy > 0 ? formatApy(asset.bestApy) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isFixed ? (
                        <span className="text-xs text-[#00d4aa] font-medium">✓ Earning {formatApy(asset.bestApy)}</span>
                      ) : (
                        <span className="font-mono font-bold text-[#ff2d2d] financial">
                          -{formatUsd(asset.yearlyLossUsd)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!isFixed && asset.bestVault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFixingAsset(asset); }}
                          className={cn(
                            "cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150",
                            "px-4 py-1.5 rounded-lg text-xs font-semibold text-white",
                            "bg-[#7c3aed] hover:bg-purple-500",
                            "shadow-[0_0_32px_rgba(124,58,237,0.25)]"
                          )}
                        >
                          Fix This →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer total */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a3a] bg-[#1a1a24]">
            <span className="text-sm text-[#5a5a6a]">Total estimated yearly loss</span>
            <span className="font-mono font-black text-2xl text-[#ff2d2d] financial">
              -{formatUsd(report.totalYearlyLossUsd)}
            </span>
          </div>
        </div>

        {/* Cards — Mobile */}
        <div className="md:hidden space-y-3 mb-6">
          {report.idleAssets.map((asset, i) => {
            const key = `${asset.token.chainId}:${asset.token.address}`;
            const isFixed = fixedKeys.has(key);
            return (
              <div
                key={key}
                className={cn(
                  "rounded-2xl border border-[#2a2a3a] bg-[#111118] p-4",
                  isFixed && "opacity-50"
                )}
                style={{ animation: `rowEnter 300ms ease-out ${i * 60}ms both` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img src={asset.token.logoUrl} alt={asset.token.symbol} className="w-7 h-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="font-semibold">{asset.token.symbol}</span>
                    <span className="text-xs text-[#5a5a6a]">
                      {CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES]}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#ff2d2d] financial">
                    -{formatUsd(asset.yearlyLossUsd)}/yr
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-[#5a5a6a]">Idle Amount</p>
                    <p className="font-mono text-[#f0f0f5]">{formatUsd(asset.usdValue)}</p>
                  </div>
                  <div>
                    <p className="text-[#5a5a6a]">Best APY</p>
                    <p className="font-mono text-[#00d4aa] font-bold">{asset.bestApy > 0 ? formatApy(asset.bestApy) : "—"}</p>
                  </div>
                  {asset.bestVault && (
                    <div className="col-span-2">
                      <p className="text-[#5a5a6a]">Best Vault</p>
                      <p className="text-[#f0f0f5] truncate">{asset.bestVault.name}</p>
                    </div>
                  )}
                </div>
                {!isFixed && asset.bestVault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFixingAsset(asset); }}
                    className="cursor-pointer w-full py-2 rounded-lg text-sm font-semibold text-white bg-[#7c3aed] hover:bg-purple-500 transition-colors active:scale-95"
                  >
                    Fix This →
                  </button>
                )}
                {isFixed && (
                  <p className="text-center text-xs text-[#00d4aa]">✓ Earning {formatApy(asset.bestApy)} APY</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {report.idleAssets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-[#00d4aa] mb-2">You're clean!</h2>
            <p className="text-[#9898a8]">No dead money detected. All your assets are working hard.</p>
          </div>
        )}

        {/* Share card + buttons */}
        <div className="mt-4 mb-2">
          <p className="text-xs text-[#5a5a6a] uppercase tracking-widest text-center mb-4">Your Dead Money Card</p>
          <ShareCard report={report} />
        </div>
        <ShareButton report={report} />
      </div>

      {/* Fix Modal */}
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

function StatItem({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[#5a5a6a] text-xs uppercase tracking-wider">{label}</p>
      <p className={cn("font-mono font-bold text-lg financial", valueClass ?? "text-[#f0f0f5]")}>{value}</p>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const scoreInfo = getScoreLabel(score);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();

    function spring(t: number) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      setAnimatedScore(Math.round(spring(progress) * score));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [score]);

  // Semicircle: total arc = 180deg. Map score 0→100 to 0→180deg
  const radius = 90;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="bg-[#111118] border border-[#1e1e2c] rounded-3xl p-8 w-72">
      <p className="text-center text-xs uppercase tracking-wider text-[#5a5a6a] mb-6">
        Dead Money Score
      </p>

      <div className="relative flex justify-center">
        <svg viewBox="0 0 220 120" className="w-52">
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF2D2D" />
              <stop offset="33%" stopColor="#FF6B35" />
              <stop offset="66%" stopColor="#F5C518" />
              <stop offset="100%" stopColor="#00D4AA" />
            </linearGradient>
          </defs>
          {/* BG arc */}
          <path
            d="M 15 110 A 95 95 0 0 1 205 110"
            stroke="#22222e"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          {/* Score arc */}
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

        {/* Score number */}
        <div className="absolute bottom-0 text-center">
          <span className="font-mono text-5xl font-black" style={{ color: scoreInfo.color }}>
            {animatedScore}
          </span>
          <span className="text-[#5a5a6a] text-sm">/100</span>
        </div>
      </div>

      <div className="text-center mt-5">
        <span
          className="inline-block px-4 py-1 rounded-full text-sm font-semibold border"
          style={{
            backgroundColor: `${scoreInfo.color}22`,
            color: scoreInfo.color,
            borderColor: `${scoreInfo.color}44`,
          }}
        >
          {scoreInfo.label} — High Dead Money
        </span>
        <p className="text-xs text-[#5a5a6a] mt-2">Lower score = more dead money. 0 is worst.</p>
      </div>
    </div>
  );
}
