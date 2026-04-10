import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import type { Route } from "./+types/scan";
import { resolveAddress, shortenAddress } from "~/lib/ens";
import { useTokenBalances } from "~/hooks/useTokenBalances";
import { usePortfolio } from "~/hooks/usePortfolio";
import { useVaults } from "~/hooks/useVaults";
import { buildReport } from "~/lib/deadMoney";
import type { DeadMoneyReport as Report, IdleAsset } from "~/lib/deadMoney";
import { ScanProgress } from "~/components/ScanProgress";
import { DeadMoneyReport } from "~/components/DeadMoneyReport";

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
    { title: `💀 Dead Money Report: ${addr}` },
    { name: "description", content: `See how much dead money ${addr} has in idle assets. Powered by LI.FI.` },
    { property: "og:title", content: `💀 Dead Money Report: ${addr}` },
    { property: "og:description", content: `Find idle assets costing ${addr} thousands yearly. Fix in one click.` },
  ];
}

function getScanStep(balanceStatus: string, portfolioStatus: string, vaultStatus: string): number {
  if (balanceStatus !== "done") return 0;
  if (portfolioStatus !== "done") return 1;
  if (vaultStatus !== "done") return 2;
  return 3;
}

export default function ScanPage({ loaderData }: Route.ComponentProps) {
  const { rawAddress } = loaderData;
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const navigate = useNavigate();

  // Resolve ENS client-side
  useEffect(() => {
    resolveAddress(rawAddress)
      .then(setResolvedAddress)
      .catch(() => setResolveError("Could not resolve address or ENS name."));
  }, [rawAddress]);

  const { balances, status: balanceStatus } = useTokenBalances(resolvedAddress);
  const { positions, status: portfolioStatus, refetch: refetchPortfolio } = usePortfolio(resolvedAddress);
  const { vaultMap, status: vaultStatus } = useVaults(
    balances,
    balanceStatus === "done" && portfolioStatus === "done"
  );

  const currentStep = getScanStep(balanceStatus, portfolioStatus, vaultStatus);
  const isDone = !!resolvedAddress && vaultStatus === "done" && balanceStatus === "done" && portfolioStatus === "done";

  useEffect(() => {
    if (!isDone || !resolvedAddress) return;
    setReport(buildReport(resolvedAddress, balances, positions, vaultMap));
  }, [isDone]);

  function handleFixed(_asset: IdleAsset) {
    refetchPortfolio();
    setTimeout(() => {
      if (resolvedAddress) setReport(buildReport(resolvedAddress, balances, positions, vaultMap));
    }, 2000);
  }

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

  if (!isDone || !report) {
    return (
      <>
        <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[#1e1e2c] h-16 flex items-center px-6">
          <Link to="/" className="font-mono font-bold text-[#f0f0f5] hover:text-white transition-colors">
            💀 Dead Money
          </Link>
        </nav>
        <ScanProgress currentStep={currentStep} />
      </>
    );
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[#1e1e2c] h-16 flex items-center justify-between px-6">
        <Link to="/" className="font-mono font-bold text-[#f0f0f5] hover:text-white transition-colors">
          💀 Dead Money
        </Link>
        <Link
          to="/"
          className="text-sm text-[#9898a8] hover:text-[#f0f0f5] transition-colors"
        >
          ← Scan another wallet
        </Link>
      </nav>
      <DeadMoneyReport report={report} onFixed={handleFixed} />
    </>
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
