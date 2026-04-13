import { usePrivy } from "@privy-io/react-auth";
import type { Route } from "./+types/deposits";
import { usePortfolio } from "~/hooks/usePortfolio";
import { MyDeposits } from "~/components/MyDeposits";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { Loader2, TrendingUp, Sparkles } from "lucide-react";
import { formatUsd } from "~/lib/deadMoney";
import { calculateYearlyYield } from "~/lib/deposits";
import { PageBackground } from "~/components/PageBackground";

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
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-[#7c3aed] animate-spin" />
        <p className="text-[#9898a8] font-medium">Scanning your on-chain positions...</p>
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return null;
  }

  const yearlySaved = calculateYearlyYield(positions);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020313] text-[#f0f0f5]" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <PageBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1164px] px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Hero Section */}
        <section className="text-center py-12 mb-8 relative">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(0,212,170,0.08),transparent)] pointer-events-none" />
           
           <div className="flex items-center justify-center gap-2 mb-4">
             <TrendingUp className="w-5 h-5 text-[#00d4aa]" />
             <span className="text-xs font-bold tracking-widest uppercase text-[#00d4aa]">Current Yield Status</span>
           </div>

           <h1 className="text-5xl sm:text-6x font-black tracking-tighter text-[#f0f0f5] mb-4">
             Your money is <span className="text-[#00d4aa] text-glow-green">working.</span>
           </h1>

           <p className="text-[#9898a8] text-lg max-w-xl mx-auto">
             You are saving <span className="text-[#00d4aa] font-bold">{formatUsd(yearlySaved)}</span> per year 
             by keeping your assets in yield-bearing vaults.
           </p>
        </section>

        {positions.length > 0 ? (
          <MyDeposits 
            positions={positions} 
            walletAddress={walletAddress} 
            onWithdrawn={refetch}
          />
        ) : (
          <div className="text-center py-20 rounded-3xl border border-dashed border-[#2a2a3a] bg-[#111118]">
            <Sparkles className="w-12 h-12 text-[#5a5a6a] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-2">No active deposits found</h2>
            <p className="text-[#9898a8] max-w-sm mx-auto mb-6">
              Scan your wallet to find idle assets and start earning yield in one click.
            </p>
            <button
               onClick={() => navigate("/")}
               className="px-6 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-purple-500 text-white font-semibold transition-all"
            >
              Start Scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
