import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { usePrivy } from "@privy-io/react-auth";
import { AddressInput } from "~/components/AddressInput";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dead Money Tracker — Find idle crypto costing you thousands" },
    {
      name: "description",
      content:
        "Scan any wallet to find idle assets bleeding yield. Get your Dead Money Score and fix it in one click with LI.FI.",
    },
    { property: "og:title", content: "💀 Dead Money Tracker" },
    {
      property: "og:description",
      content: "Your crypto is bleeding out. Find how much you're losing to idle assets.",
    },
  ];
}

export default function Home() {
  const { authenticated, login, user } = usePrivy();
  const navigate = useNavigate();

  function handleConnectAndScan() {
    if (authenticated && user?.wallet?.address) {
      navigate(`/scan/${user.wallet.address}`);
    } else {
      login();
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5] flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[#1e1e2c] h-16 flex items-center justify-between px-6">
        <Link to="/" className="font-mono font-bold text-[#f0f0f5] text-lg hover:text-white transition-colors">
          💀 Dead Money
        </Link>
        <button
          onClick={handleConnectAndScan}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#2a2a3a] text-[#9898a8] hover:text-[#f0f0f5] hover:border-[#3a3a4e] transition-all duration-200"
        >
          {authenticated ? "My Wallet →" : "Connect Wallet"}
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Radial bg gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.13),transparent)] pointer-events-none" />

        {/* Floating particles */}
        <Particles />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto gap-6">
          {/* Eyebrow */}
          <span className="text-xs font-medium tracking-widest uppercase text-[#7c3aed] bg-[#7c3aed]/10 border border-[#7c3aed]/20 px-4 py-1.5 rounded-full">
            DeFi Mullet Hackathon — Track 3: UX Challenge
          </span>

          {/* H1 */}
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-[#f0f0f5] leading-tight">
            Your crypto is{" "}
            <span className="text-[#ff2d2d] text-glow-red">bleeding out.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[#9898a8] max-w-md">
            Find idle assets costing you thousands yearly.{" "}
            <span className="text-[#f0f0f5]">Fix in one click.</span>
          </p>

          {/* Input */}
          <div className="w-full mt-2">
            <AddressInput />
          </div>

          {/* Connect wallet shortcut */}
          <button
            onClick={handleConnectAndScan}
            className="text-sm text-[#9898a8] hover:text-[#a78bfa] transition-colors underline underline-offset-4"
          >
            {authenticated ? "→ Scan my connected wallet" : "Or connect wallet to scan yours →"}
          </button>

          {/* Social proof */}
          <div className="flex items-center gap-3 bg-[#111118] border border-[#1e1e2c] rounded-2xl px-6 py-3 mt-2">
            <span className="w-2 h-2 rounded-full bg-[#ff2d2d] animate-pulse flex-shrink-0" />
            <span className="text-xs text-[#5a5a6a]">
              <span className="text-[#9898a8]">$4.2M</span> dead money detected today
              {" "}•{" "}
              <span className="text-[#9898a8]">1,247</span> wallets scanned
              {" "}•{" "}
              avg <span className="text-[#ff2d2d]">$3,400/yr</span> lost
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#5a5a6a] border-t border-[#1e1e2c]">
        Built with{" "}
        <a href="https://li.fi" target="_blank" rel="noopener noreferrer" className="text-[#7c3aed] hover:text-[#a78bfa]">
          LI.FI
        </a>{" "}
        Earn API + Composer · DeFi Mullet Hackathon 2026
      </footer>
    </div>
  );
}

// Simple CSS-only particle dots
function Particles() {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    opacity: Math.random() * 0.3 + 0.05,
    duration: Math.random() * 4 + 3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full bg-[#7c3aed]"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            opacity: dot.opacity,
            animation: `pulseRed ${dot.duration}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
