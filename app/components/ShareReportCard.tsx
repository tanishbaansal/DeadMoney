import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { toPng } from "html-to-image";
import type { DeadMoneyReport } from "~/lib/deadMoney";
import { formatUsd, getScoreLabel } from "~/lib/deadMoney";
import { CHAIN_NAMES } from "~/lib/tokens";
import { shortenAddress } from "~/lib/ens";
import { cn } from "~/lib/utils";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface ShareReportCardProps {
  report: DeadMoneyReport;
}

export function ShareReportCard({ report }: ShareReportCardProps) {
  const info = getScoreLabel(report.deadMoneyScore);
  const topAsset = report.idleAssets[0];
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const isHealthy = report.totalYearlyLossUsd <= 0.01;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/scan/${report.address}`
      : `/scan/${report.address}`;

  const tokens = report.idleAssets
    .map((a) => `$${a.token.symbol}`)
    .slice(0, 3)
    .join(", ");

  const tweetText = encodeURIComponent(
    isHealthy
      ? `My money is working! 💪\n\nDead Money Score: ${report.deadMoneyScore}/100 (${info.label})\nEvery dollar earning yield.\n\nCheck yours: ${shareUrl}\n\nMade with @lifiprotocol #DeFiMullet #DeadMoney`
      : `I just found ${formatUsd(report.totalYearlyLossUsd)} in dead money in my wallet 💀\n\nDead Money Score: ${report.deadMoneyScore}/100 (${info.label})\n${tokens} sitting idle\n\nFix yours: ${shareUrl}\n\nMade with @lifiprotocol #DeFiMullet #DeadMoney`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  async function copyCardImage() {
    if (!cardRef.current || copying) return;
    setCopying(true);
    try {
      // Clone the card into an off-screen container at a fixed width so that
      // viewport-relative units (vw, clamp) and flex wrapping are deterministic.
      const source = cardRef.current;
      const FIXED_WIDTH = 480;
      const clone = source.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${FIXED_WIDTH}px`;
      clone.style.maxWidth = `${FIXED_WIDTH}px`;
      clone.style.transform = "none";

      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.width = `${FIXED_WIDTH}px`;
      holder.style.pointerEvents = "none";
      holder.style.zIndex = "-1";
      holder.appendChild(clone);
      document.body.appendChild(holder);

      // Wait a frame so layout settles (images, fonts)
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const height = clone.scrollHeight;

      const dataUrl = await toPng(clone, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#020313",
        width: FIXED_WIDTH,
        height,
      });

      document.body.removeChild(holder);

      const blob = await (await fetch(dataUrl)).blob();
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `dead-money-${shortenAddress(report.address)}.png`;
        link.click();
      }
    } catch (err) {
      console.error("Failed to copy card image:", err);
    } finally {
      setCopying(false);
    }
  }

  const gradient = isHealthy
    ? "linear-gradient(180deg, #0e0b14 0%, #0a3026 44%, #0e0b14 100%)"
    : "linear-gradient(180deg, #0e0b14 0%, #1f0945 44%, #0e0b14 100%)";

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        ref={cardRef}
        className="w-full max-w-[480px] mx-auto rounded-[20px] border border-[#0e0b14] px-6 py-8 flex flex-col gap-6"
        style={{
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          background: gradient,
        }}
      >
        {/* Header: logo only */}
        <div className="flex items-center gap-2">
          <img
            src="/logo-icon.svg"
            alt=""
            className="w-6 h-6"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-[18px] font-medium text-white leading-none">
            Dead Money
          </span>
        </div>

        {/* Headline */}
        <div className="flex flex-col items-center gap-2 text-center pt-1">
          {isHealthy ? (
            <>
              <p className="text-[11px] font-medium text-white tracking-[0.48px] uppercase">
                Status
              </p>
              <p className="text-[#00d4aa] font-medium leading-none text-[44px] sm:text-[52px]">
                All Good
              </p>
              <p className="text-[15px] text-white">
                Every dollar is{" "}
                <span className="font-medium text-[#00d4aa] text-[18px]">
                  working
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium text-white tracking-[0.48px] uppercase">
                Yearly Loss From Idle Assets
              </p>
              <p className="text-[#e40000] font-medium leading-none text-[48px] sm:text-[56px]">
                -{formatUsd(report.totalYearlyLossUsd)}
              </p>
              <p className="text-[15px] text-white">
                Bleeding{" "}
                <span className="font-medium text-[#e40000] text-[18px]">
                  -{formatUsd(report.totalDailyLossUsd)}/day
                </span>
              </p>
            </>
          )}
        </div>

        {/* Score row */}
        <div className="rounded-[10px] bg-[rgba(14,11,20,0.8)] px-4 py-4 flex items-center gap-4">
          <p className="shrink-0 leading-none">
            <span
              className="text-[36px] font-normal"
              style={{ color: isHealthy ? "#00d4aa" : "#e40000" }}
            >
              {report.deadMoneyScore}
            </span>
            <span className="text-[#cacaca] text-[18px]">/100</span>
          </p>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex px-2.5 py-1 rounded-[4px] text-[10px] font-bold tracking-[0.84px] uppercase"
                style={{ backgroundColor: `${info.color}26`, color: info.color }}
              >
                {info.label}
              </span>
              <span className="text-[12px] text-[#cacaca] text-right">
                Dead Money Score
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#2a2a3a] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(report.deadMoneyScore, 4)}%`,
                  background:
                    "linear-gradient(90deg, #FF2D2D 0%, #FF6B35 33%, #F5C518 66%, #00D4AA 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Top idle asset row — only when there's an idle asset */}
        {!isHealthy && topAsset && (
          <div className="rounded-[10px] bg-[rgba(14,11,20,0.8)] px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {topAsset.token.logoUrl ? (
                <img
                  src={topAsset.token.logoUrl}
                  alt=""
                  className="w-9 h-9 rounded-full border border-[#2a2a3a] shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#272727] shrink-0" />
              )}
              <p className="text-[14px] font-medium text-white tracking-[0.64px] uppercase truncate">
                {topAsset.token.symbol}
              </p>
              <p className="text-[12px] text-[#cacaca] tracking-[0.56px] capitalize truncate">
                {CHAIN_NAMES[topAsset.token.chainId as keyof typeof CHAIN_NAMES] ??
                  topAsset.token.chainId}
              </p>
            </div>
            <p className="text-[18px] font-normal text-[#e40000] whitespace-nowrap">
              -{formatUsd(topAsset.yearlyLossUsd)}/yr
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[#373737] pt-4 flex items-center justify-between">
          <p className="text-[11px] text-[#cacaca] tracking-[0.56px] capitalize">
            Powered By LI.FI Earn API
          </p>
          <p className="text-[11px] text-[#c9f352] tracking-[0.56px] capitalize">
            deadmoney.xyz
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <button
          onClick={copyCardImage}
          disabled={copying}
          className={cn(
            "cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95",
            "border border-[#373737]/40 bg-[#1a1a24] px-3 py-2 text-[13px] font-bold text-[#fff] transition-colors hover:bg-[#22222e]",
            copying && "opacity-60 cursor-wait"
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-[#00d4aa]" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {copying ? "Copying..." : "Copy Card"}
            </>
          )}
        </button>

        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
          "cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold text-white",
          "border border-[#c9f352]/40 bg-[#c9f352]/10 px-3 py-2 text-[13px] font-bold text-[#c9f352] transition-colors hover:bg-[#c9f352]/20",
          "transition-all duration-200 active:scale-95"
        )}>
          <XIcon className="w-4 h-4" />
          Share on X
        </a>
      </div>
    </div>
  );
}
