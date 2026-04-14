import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/scan";
import { usePrivy } from "@privy-io/react-auth";
import { resolveAddress, shortenAddress } from "~/lib/ens";
import { useTokenBalances } from "~/hooks/useTokenBalances";
import { usePortfolio } from "~/hooks/usePortfolio";
import { useVaults } from "~/hooks/useVaults";
import { buildReport } from "~/lib/deadMoney";
import type { DeadMoneyReport as Report, IdleAsset } from "~/lib/deadMoney";
import { ScanProgress } from "~/components/ScanProgress";
import { DeadMoneyReport, ActiveYieldCard } from "~/components/DeadMoneyReport";
import { MyDeposits } from "~/components/MyDeposits";
import { ShareReportCard } from "~/components/ShareReportCard";
import { PageBackground } from "~/components/PageBackground";
import { getBestApy } from "~/lib/earnApi";
import { useToast } from "~/components/Toast";

// Lightweight server loader — just passes the raw param through.
// ENS resolution happens client-side to avoid viem Node.js issues in SSR.
export function loader({ params }: Route.LoaderArgs) {
  const { address } = params;
  if (!address) throw new Response("Missing address", { status: 400 });
  return { rawAddress: address };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Scan — Dead Money Tracker" }];
  const addr = shortenAddress(data.rawAddress);
  return [
    { title: `Dead Money Report: ${addr}` },
    { name: "description", content: `See how much dead money ${addr} has in idle assets. Powered by LI.FI.` },
    { property: "og:title", content: `Dead Money Report: ${addr}` },
    { property: "og:description", content: `Find idle assets costing ${addr} thousands yearly. Fix in one click.` },
  ];
}

function getScanStep(balanceStatus: string, portfolioStatus: string, vaultStatus: string): number {
  if (balanceStatus === "loading") return 0;
  if (portfolioStatus === "loading") return 1;
  if (vaultStatus === "loading") return 2;
  return 3;
}

export default function ScanPage({ loaderData }: Route.ComponentProps) {
  const { rawAddress } = loaderData;
  const { authenticated, user } = usePrivy();
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const navigate = useNavigate();
  const connectedAddress =
    user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ?? null;
  const canFixScannedWallet =
    !!authenticated &&
    !!connectedAddress &&
    !!resolvedAddress &&
    connectedAddress.toLowerCase() === resolvedAddress.toLowerCase();
  const fixDisabledReason = !authenticated
    ? "Connect your wallet to use Fix This."
    : connectedAddress && resolvedAddress && connectedAddress.toLowerCase() !== resolvedAddress.toLowerCase()
      ? "Connect your wallet to use Fix This on your assets."
      : "Fix unavailable.";

  // Resolve ENS client-side
  useEffect(() => {
    resolveAddress(rawAddress)
      .then(setResolvedAddress)
      .catch(() => setResolveError("Could not resolve address or ENS name."));
  }, [rawAddress]);

  const { balances, status: balanceStatus, refetch: refetchBalances } = useTokenBalances(resolvedAddress);
  const { positions, status: portfolioStatus, refetch: refetchPortfolio } = usePortfolio(resolvedAddress);
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const refreshToastIdRef = useRef<number | null>(null);
  const refreshSawLoadingRef = useRef(false);

  const isReadyForVaults = (balanceStatus === "done" || balanceStatus === "error") && 
                           (portfolioStatus === "done" || portfolioStatus === "error");

  const { vaultMap, status: vaultStatus } = useVaults(balances, isReadyForVaults);

  const currentStep = getScanStep(balanceStatus, portfolioStatus, vaultStatus);
  const isDone = !!resolvedAddress && 
                 (vaultStatus === "done" || vaultStatus === "error") && 
                 (balanceStatus === "done" || balanceStatus === "error") && 
                 (portfolioStatus === "done" || portfolioStatus === "error");

  useEffect(() => {
    if (!isDone || !resolvedAddress) return;
    setReport(buildReport(resolvedAddress, balances, positions, vaultMap));
  }, [isDone, resolvedAddress, balances, positions, vaultMap]);

  function handleFixed(_asset: IdleAsset) {
    // Show loading toast + skeleton overlay until refetch resolves
    if (refreshToastIdRef.current == null) {
      refreshToastIdRef.current = toast.show("Fetching latest positions…", "loading");
    }
    refreshSawLoadingRef.current = false;
    setRefreshing(true);
    setTimeout(() => {
      refetchBalances();
      refetchPortfolio();
    }, 3000); // Wait for chain settlement
  }

  // Clear refreshing state + toast once portfolio refetch finishes (after we've seen loading)
  useEffect(() => {
    if (!refreshing) return;
    if (portfolioStatus === "loading") {
      refreshSawLoadingRef.current = true;
      return;
    }
    if (
      refreshSawLoadingRef.current &&
      (portfolioStatus === "done" || portfolioStatus === "error")
    ) {
      const t = setTimeout(() => {
        setRefreshing(false);
        refreshSawLoadingRef.current = false;
        if (refreshToastIdRef.current != null) {
          toast.update(refreshToastIdRef.current, {
            message: "Positions updated",
            variant: "success",
            duration: 2500,
          });
          refreshToastIdRef.current = null;
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [refreshing, portfolioStatus, toast]);

  if (resolveError) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-2xl font-bold text-[#f0f0f5]">Invalid wallet address</h1>
        <p className="text-[#9898a8] text-center max-w-sm">{resolveError}</p>
        <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-[#7c3aed] text-white font-semibold hover:bg-purple-500 transition-colors">
          ← Go back
        </button>
      </div>
    );
  }

  if (!report) {
    return <ScanProgress currentStep={currentStep} />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020313] pb-20">
      <PageBackground />

      <div className="relative z-10">
        <DeadMoneyReport
          report={report}
          onFixed={handleFixed}
          activePositions={positions}
          canFix={canFixScannedWallet}
          fixDisabledReason={fixDisabledReason}
          hideActiveYield
          refreshing={refreshing}
        />
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-12">
          <ShareReportCard report={report} />
        </div>
        {positions.length > 0 && resolvedAddress && (
          <>
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-6">
              <ActiveYieldCard
                activeUsd={positions.reduce((s, p) => s + (p.stakedTokenAmountUsd ?? 0), 0)}
                annualYield={positions.reduce(
                  (s, p) => s + (p.stakedTokenAmountUsd ?? 0) * (getBestApy(p.vault) / 100),
                  0
                )}
                hasActive
              />
            </div>
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-12">
              <MyDeposits
                positions={positions}
                walletAddress={resolvedAddress}
                onWithdrawn={() => handleFixed(null as any)}
                variant="scan"
                refreshing={refreshing}
                showBottomWorkingMessage={report.idleAssets.length > 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-2xl font-bold text-[#f0f0f5]">Invalid wallet address</h1>
      <p className="text-[#9898a8] text-center max-w-sm">
        That address couldn't be resolved. Try a valid Ethereum address (0x...) or ENS name (name.eth).
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 rounded-xl bg-[#7c3aed] text-white font-semibold hover:bg-purple-500 transition-colors"
      >
        ← Go back
      </button>
    </div>
  );
}
