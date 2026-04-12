import { useRef, useState } from "react";
import type { DeadMoneyReport } from "~/lib/deadMoney";
import { formatUsd, formatApy, getScoreLabel } from "~/lib/deadMoney";
import { CHAIN_NAMES } from "~/lib/tokens";
import { shortenAddress } from "~/lib/ens";

interface ShareCardProps {
  report: DeadMoneyReport;
}

export function ShareCard({ report }: ShareCardProps) {
  const scoreInfo = getScoreLabel(report.deadMoneyScore);
  const topAssets = report.idleAssets.slice(0, 3);
  const avgApy = report.idleAssets.length > 0
    ? report.idleAssets.reduce((s, a) => s + a.bestApy, 0) / report.idleAssets.length
    : 0;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* The card itself — styled to look shareable */}
      <div
        className="relative rounded-3xl overflow-hidden border border-[#2a2a3a]"
        style={{
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #0a0a0f 100%)",
        }}
      >
        {/* Top red glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#ff2d2d]/20 blur-3xl rounded-full" />
        {/* Bottom purple glow */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#7c3aed]/15 blur-3xl rounded-full" />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">💀</span>
              <span className="font-mono font-bold text-[#f0f0f5] text-sm">Dead Money</span>
            </div>
            <span className="font-mono text-xs text-[#5a5a6a] bg-[#22222e] px-2 py-1 rounded-lg">
              {shortenAddress(report.address)}
            </span>
          </div>

          {/* Big loss number */}
          <div className="text-center mb-5">
            <p className="text-xs text-[#5a5a6a] uppercase tracking-widest mb-1">Yearly Loss from Idle Assets</p>
            <p
              className="font-black tracking-tighter financial"
              style={{
                fontSize: "clamp(2.5rem, 10vw, 4rem)",
                color: "#ff2d2d",
                textShadow: "0 0 30px rgba(255,45,45,0.5)",
              }}
            >
              -{formatUsd(report.totalYearlyLossUsd)}
            </p>
            <p className="text-[#9898a8] text-sm mt-1">
              bleeding <span className="text-[#ff2d2d]">{formatUsd(report.totalDailyLossUsd, true)}/day</span>
            </p>
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-3 bg-[#22222e]/80 rounded-2xl p-3 mb-4">
            <div className="flex-shrink-0 text-center w-16">
              <span className="font-mono font-black text-2xl" style={{ color: scoreInfo.color }}>
                {report.deadMoneyScore}
              </span>
              <p className="text-[10px] text-[#5a5a6a]">/100</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: scoreInfo.color }}>
                  {scoreInfo.label}
                </span>
                <span className="text-xs text-[#5a5a6a]">Dead Money Score</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2a2a3a] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${report.deadMoneyScore}%`,
                    background: `linear-gradient(90deg, #FF2D2D, #FF6B35, #F5C518, #00D4AA)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Top idle assets */}
          {topAssets.length > 0 && (
            <div className="space-y-2 mb-4">
              {topAssets.map((asset) => (
                <div
                  key={`${asset.token.chainId}:${asset.token.address}`}
                  className="flex items-center justify-between bg-[#22222e]/60 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <img src={asset.token.logoUrl} alt={asset.token.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-sm font-medium text-[#f0f0f5]">{asset.token.symbol}</span>
                    <span className="text-xs text-[#5a5a6a]">{CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES]}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-[#ff2d2d]">
                      -{formatUsd(asset.yearlyLossUsd)}/yr
                    </span>
                    {asset.bestApy > 0 && (
                      <span className="text-xs text-[#00d4aa] ml-2">best: {formatApy(asset.bestApy)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#1e1e2c]">
            <span className="text-xs text-[#5a5a6a]">powered by LI.FI Earn API</span>
            <span className="text-xs text-[#7c3aed] font-mono">deadmoney.xyz</span>
          </div>
        </div>
      </div>
    </div>
  );
}
