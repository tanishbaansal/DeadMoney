interface ScanProgressProps {
  currentStep: number; // 0–3
}

const STEPS = [
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

export function ScanProgress({ currentStep }: ScanProgressProps) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#020313] text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* Background nebula — blurred, dimmed, matches home */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 select-none"
        style={{
          backgroundImage: "url('/hero-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 30%",
          backgroundSize: "140% auto",
          filter: "blur(40px) brightness(0.45) saturate(1.1)",
          transform: "scale(1.05)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 58%, rgba(2,3,19,0) 0%, rgba(2,3,19,0.55) 60%, rgba(2,3,19,0.92) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[rgba(30,30,30,0.19)]"
      />

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-20">
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
                src="/skull.svg"
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
              Hunting For Dead Money
            </h1>

            <p
              className="m-0 max-w-[869px] text-center text-white"
              style={{
                fontSize: "clamp(16px, 1.35vw, 24px)",
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              Digging through your wallets. This may hurt.
            </p>
          </div>

          {/* Rows */}
          <div
            className="flex w-full flex-col items-center"
            style={{ gap: "12px", maxWidth: "620px" }}
          >
            {STEPS.map((step, i) => (
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
