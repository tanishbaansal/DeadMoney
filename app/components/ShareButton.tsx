import { useState } from "react";
import { Link2, Check } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
import { cn } from "~/lib/utils";
import type { DeadMoneyReport } from "~/lib/deadMoney";
import { formatUsd, getScoreLabel } from "~/lib/deadMoney";

interface ShareButtonProps {
  report: DeadMoneyReport;
}

export function ShareButton({ report }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/scan/${report.address}`
    : `/scan/${report.address}`;

  const scoreInfo = getScoreLabel(report.deadMoneyScore);
  const lossStr = formatUsd(report.totalYearlyLossUsd);
  const tokens = report.idleAssets.map((a) => `$${a.token.symbol}`).slice(0, 3).join(", ");

  const tweetText = encodeURIComponent(
    `I just found ${lossStr} in dead money in my wallet 💀\n\nMy Dead Money Score: ${report.deadMoneyScore}/100 (${scoreInfo.label})\n${tokens} sitting idle\n\nFix yours: ${shareUrl}\n\nMade with @lifiprotocol #DeFiMullet #DeadMoney`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 justify-center py-8">
      <button
        onClick={copyLink}
        className={cn(
          "cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium",
          "border border-[#2a2a3a] text-[#9898a8]",
          "hover:text-[#f0f0f5] hover:border-[#3a3a4e]",
          "transition-all duration-200"
        )}
      >
        {copied ? (
          <Check className="w-4 h-4 text-[#00d4aa]" />
        ) : (
          <Link2 className="w-4 h-4" />
        )}
        {copied ? "Copied!" : "Copy Link"}
      </button>

      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white",
          "bg-[#1DA1F2] hover:bg-[#1a8fd1]",
          "transition-all duration-200 active:scale-95"
        )}
      >
        <XIcon className="w-4 h-4" />
        Share on X
      </a>
    </div>
  );
}
