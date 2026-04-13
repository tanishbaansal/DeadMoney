import { usePrivy } from "@privy-io/react-auth";
import type { Route } from "./+types/deposits";
import { usePortfolio } from "~/hooks/usePortfolio";
import { MyDeposits } from "~/components/MyDeposits";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { formatUsd } from "~/lib/deadMoney";
import { calculateYearlyYield, estimateTotalGrowth } from "~/lib/deposits";
import { PageBackground } from "~/components/PageBackground";
import { ScanProgress } from "~/components/ScanProgress";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Deposits — Dead Money Tracker" },
    {
      name: "description",
      content: "Track your yield-bearing assets and total yearly savings across all chains.",
    },
  ];
}

export default function DepositsPage() {
  const { authenticated, user, ready } = usePrivy();
  const navigate = useNavigate();

  const walletAddress =
    user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ?? null;

  const { positions, status, refetch } = usePortfolio(walletAddress);

  useEffect(() => {
    if (ready && !authenticated) {
      navigate("/");
    }
  }, [ready, authenticated, navigate]);

  if (!ready || status === "loading") {
    return (
      <ScanProgress
        currentStep={0}
        title="Loading Your Investments"
        subtitle="Syncing your on-chain deposits. This may take a moment."
        steps={[
          { label: "Scanning Token Balances" },
          { label: "Checking Active Positions" },
          { label: "Fetching Yield Opportunities" },
          { label: "Preparing Investments View" },
        ]}
      />
    );
  }

  if (!authenticated || !walletAddress) {
    return null;
  }

  const yearlySaved = calculateYearlyYield(positions);
  const currentGrowth = estimateTotalGrowth(positions);
  const totalDeposited = positions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020313] text-[#f0f0f5]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <PageBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1164px] px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {positions.length > 0 ? (
          <>
            {/* Gradient "Your Money Is Working!" hero */}
            <section
              className="rounded-[12px] backdrop-blur-[37.65px] px-6 sm:px-8 py-10 flex flex-col items-center gap-10"
              style={{
                backgroundImage:
                  "linear-gradient(112.07deg, rgba(2, 9, 6, 0.9) 0%, rgba(0, 41, 33, 0.396) 98.22%)",
              }}
            >
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00a888]" strokeWidth={2} />
                  <span className="text-[12px] font-medium tracking-[0.48px] uppercase text-[#00a888]">
                    Current Yield Status
                  </span>
                </div>

                <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-medium text-white">
                  Your Money Is <span className="text-[#00a888]">Working!</span>
                </h1>

                <p className="text-white text-[16px] sm:text-[20px] max-w-[772px]">
                  You are saving{" "}
                  <span className="text-[#00a888] font-bold text-[22px] sm:text-[32px] align-baseline">
                    {formatUsd(yearlySaved)}
                  </span>{" "}
                  per year by keeping your assets in yield-bearing vaults.
                </p>
              </div>

              <div className="flex flex-wrap items-stretch justify-center gap-y-4 text-center">
                <DHeroStat label="Total Deposit" value={formatUsd(totalDeposited)} border />
                <DHeroStat label="Saving / Year" value={`+${formatUsd(yearlySaved)}`} border />
                <DHeroStat
                  label="Est. Current Growth"
                  value={`+${formatUsd(currentGrowth)}`}
                  valueClass="text-[#00a888]"
                />
              </div>
            </section>

            <MyDeposits
              positions={positions}
              walletAddress={walletAddress}
              onWithdrawn={refetch}
              variant="deposits"
            />
          </>
        ) : (
          <section
            className="rounded-[12px] backdrop-blur-[37.65px] px-6 sm:px-8 py-14 sm:py-16 flex flex-col items-center gap-8 text-center"
            style={{
              backgroundImage:
                "linear-gradient(112.07deg, rgba(2, 9, 6, 0.9) 0%, rgba(0, 41, 33, 0.396) 98.22%)",
            }}
          >
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00a888]" strokeWidth={2} />
                <span className="text-[12px] font-medium tracking-[0.48px] uppercase text-[#00a888]">
                  Current Yield Status
                </span>
              </div>

              <h2 className="text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.05] font-medium text-white">
                No Active <span className="text-[#00a888]">Deposits</span>
              </h2>
            </div>

            <p className="text-white text-[16px] sm:text-[20px] max-w-[760px]">
              Scan your wallet to find idle assets and start earning yield in one click.
            </p>

            <button
              onClick={() => navigate("/")}
              className="cursor-pointer px-7 py-3 rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] text-black text-[16px] font-medium transition-colors active:scale-[0.99]"
            >
              Start Scanning
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function DHeroStat({
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
        "flex flex-col items-center justify-center gap-3 px-6 min-w-[160px] " +
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
