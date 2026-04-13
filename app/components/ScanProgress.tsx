import { PageBackground } from "./PageBackground";

interface ScanProgressProps {
  currentStep: number; // 0–3
  title?: string;
  subtitle?: string;
  steps?: Array<{ label: string }>;
}

const DEFAULT_STEPS = [
  { label: "Scanning Token Balances" },
  { label: "Checking Active Positions" },
  { label: "Sourcing Best Vaults" },
  { label: "Computing Dead Money" },
];

type RowState = "done" | "scanning" | "waiting";

function getState(i: number, currentStep: number): RowState {
  if (i < currentStep) return "done";
  if (i === currentStep) return "scanning";
  return "waiting";
}

export function ScanProgress({
  currentStep,
  title = "Hunting For Dead Money",
  subtitle = "Digging through your wallets. This may hurt.",
  steps = DEFAULT_STEPS,
}: ScanProgressProps) {
  return (
    <div
      className="relative w-full overflow-hidden bg-[#020313] text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      
            <PageBackground />
      

      {/* Main content */}
      <main className="relative z-10 flex items-center justify-center px-6 py-20">
        <div
          className="flex w-full max-w-[1149px] flex-col items-center justify-center"
          style={{ gap: "56px" }}
        >
          {/* Heading block */}
          <div
            className="flex w-full flex-col items-center"
            style={{ gap: "24px" }}
          >
            {/* Skull */}
            <div className="relative" style={{ width: "144px", height: "144px" }}>
              <img
                src="/logo-icon.svg"
                alt=""
                className="h-full w-full"
                style={{
                  filter:
                    "drop-shadow(0 0 24px rgba(201,243,82,0.35)) drop-shadow(0 0 48px rgba(201,243,82,0.18))",
                  animation: "scanPulse 2.2s ease-in-out infinite",
                }}
                draggable={false}
              />
            </div>

            <h1
              className="m-0 w-full text-center text-white"
              style={{
                fontSize: "clamp(32px, 4.2vw, 48px)",
                fontWeight: 500,
                lineHeight: 1.1,
              }}
            >
              {title}
            </h1>

            <p
              className="m-0 max-w-[869px] text-center text-white"
              style={{
                fontSize: "clamp(16px, 1.35vw, 24px)",
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          </div>

          {/* Rows */}
          <div
            className="flex w-full flex-col items-center"
            style={{ gap: "12px", maxWidth: "620px" }}
          >
            {steps.map((step, i) => (
              <StepRow
                key={step.label}
                label={step.label}
                state={getState(i, currentStep)}
              />
            ))}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes scanPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.88; }
        }
        @keyframes scanDotBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

function StepRow({
  label,
  state,
}: {
  label: string;
  state: RowState;
}) {
  const isWaiting = state === "waiting";
  const dotColor =
    state === "done"
      ? "#01e676"
      : state === "scanning"
        ? "#c9f352"
        : "#3a3a3a";

  return (
    <div
      className="flex w-full items-center justify-between rounded-[4px] border p-5"
      style={{
        height: "76px",
        background: "rgba(14,15,29,0.61)",
        backdropFilter: "blur(12.35px)",
        WebkitBackdropFilter: "blur(12.35px)",
        borderColor: "rgba(201,243,82,0.07)",
        boxShadow: "0 2px 14.1px rgba(0,0,0,0.12)",
      }}
    >
      <div className="flex items-center gap-[10px] px-2">
        <span
          className="inline-block rounded-full"
          style={{
            width: "8px",
            height: "8px",
            background: dotColor,
            animation:
              state === "scanning" ? "scanDotBlink 1.1s ease-in-out infinite" : undefined,
          }}
        />
        <span
          className="text-[16px]"
          style={{
            color: isWaiting ? "#3a3a3a" : "#ffffff",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>

      <div
        className="flex items-center justify-center rounded-[4px]"
        style={{ gap: "8px", padding: "10px 16px" }}
      >
        {state === "done" && (
          <>
            <CheckIcon />
            <span
              className="whitespace-nowrap text-[16px]"
              style={{ color: "#01e676", fontWeight: 500 }}
            >
              Done
            </span>
          </>
        )}
        {state === "scanning" && (
          <span
            className="whitespace-nowrap text-[16px] text-white"
            style={{ fontWeight: 500 }}
          >
            Scanning...
          </span>
        )}
        {state === "waiting" && (
          <span
            className="whitespace-nowrap text-[16px] text-white"
            style={{ fontWeight: 500 }}
          >
            Waiting
          </span>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.5 10.5L8.5 14.5L16 6.5"
        stroke="#01e676"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
