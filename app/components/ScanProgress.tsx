import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";

const STEPS = [
  { label: "Scanning tokens", sub: "Checking your entire token portfolio" },
  { label: "Checking positions", sub: "Looking at staking, LP, and lending positions" },
  { label: "Finding yields", sub: "Sourcing best available vaults via LI.FI" },
  { label: "Calculating losses", sub: "Computing what you've missed out on" },
];

interface ScanProgressProps {
  currentStep: number; // 0–3
}

export function ScanProgress({ currentStep }: ScanProgressProps) {
  const [rollingLoss, setRollingLoss] = useState(847);

  useEffect(() => {
    const tick = () => {
      const increment = Math.floor(Math.random() * 490) + 10;
      setRollingLoss((prev) => prev + increment);
      setTimeout(tick, Math.floor(Math.random() * 600) + 300);
    };
    const id = setTimeout(tick, 400);
    return () => clearTimeout(id);
  }, []);

  const displayedLoss = rollingLoss.toLocaleString("en-US");

  return (
    <div className="flex flex-col items-center gap-8 py-20 px-6 min-h-screen bg-[#0a0a0f]">

      {/* Spinning ring */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg
          viewBox="0 0 96 96"
          className="w-24 h-24"
          style={{ animation: "spinRing 1.2s linear infinite" }}
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#ff2d2d" />
            </linearGradient>
          </defs>
          <circle
            cx="48" cy="48" r="40"
            stroke="url(#ringGrad)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="180 72"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          💀
        </div>
      </div>

      {/* Current step text */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#f0f0f5]">
          {STEPS[currentStep]?.label ?? "Analyzing..."}
        </h2>
        <p className="text-[#9898a8] text-sm mt-1">
          {STEPS[currentStep]?.sub}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive && "bg-[#22222e] border border-[#7c3aed]/30",
                isDone && "opacity-60"
              )}
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-[#00d4aa] flex-shrink-0" />
              ) : isActive ? (
                <div className="w-5 h-5 rounded-full border-2 border-[#7c3aed] flex-shrink-0 relative">
                  <div className="absolute inset-0.5 rounded-full bg-[#7c3aed] animate-pulse" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-[#5a5a6a] flex-shrink-0" />
              )}
              <span
                className={cn(
                  "text-sm",
                  isActive ? "text-[#f0f0f5] font-semibold" : "text-[#5a5a6a]",
                  isDone && "line-through text-[#5a5a6a]"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rolling loss counter */}
      <div className="text-center mt-2">
        <p className="text-[#5a5a6a] text-xs mb-2 uppercase tracking-widest">
          Estimated yearly loss found so far
        </p>
        <p className="font-mono text-4xl font-black text-[#ff2d2d] financial">
          -${displayedLoss}
        </p>
        <p className="text-xs text-[#5a5a6a] mt-2">
          Wallets like yours lose an average of <span className="text-[#ff2d2d]">$3,400/year</span>
        </p>
      </div>
    </div>
  );
}
