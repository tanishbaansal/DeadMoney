import { useState } from "react";
import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { usePrivy } from "@privy-io/react-auth";
import { resolveAddress } from "~/lib/ens";
import { Navbar } from "~/components/Navbar";
import { PageBackground } from "~/components/PageBackground";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dead Money — Your idle crypto is bleeding" },
    {
      name: "description",
      content:
        "Scan any wallet to find idle assets bleeding yield. Connect your wallet and fix it in one click with LI.FI.",
    },
    { property: "og:title", content: "Dead Money" },
    {
      property: "og:description",
      content: "Your idle crypto is bleeding. Fix it in one click.",
    },
  ];
}

export default function Home() {
  const { ready, authenticated, login, logout, user, connectWallet } = usePrivy();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const walletAddress =
    user?.wallet?.address ??
    user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ??
    null;

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setError("");
    setSubmitting(true);
    try {
      const addr = await resolveAddress(trimmed);
      navigate(`/scan/${addr}`);
    } catch {
      setError("Invalid address or ENS name");
      setSubmitting(false);
    }
  }

  function handleConnectWallet() {
    if (authenticated && walletAddress) {
      navigate(`/scan/${walletAddress}`);
    } else {
      login();
    }
  }

  async function handleDisconnect() {
    try {
      await logout();
    } catch {
      // noop
    }
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#020313] text-white"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <PageBackground />

      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <main className="relative z-10 flex min-h-[calc(100vh-68px)] items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-[1149px] flex-col items-center gap-12">
          {/* Eyebrow + Headline + Subtitle */}
          <div className="flex w-full flex-col items-center gap-6">
            <div className="inline-flex items-center justify-center bg-[rgba(201,243,82,0.09)] px-5 py-3">
              <p
                className="whitespace-nowrap text-center text-[14px] font-bold text-[#c9f352]"
                style={{ letterSpacing: "1.68px", lineHeight: "normal" }}
              >
                DEFI MULLET HACKATHON - TRACK 3: UX CHALLENGE
              </p>
            </div>

            <h1
              className="m-0 w-full text-center text-white"
              style={{
                fontSize: "clamp(44px, 6.5vw, 96px)",
                lineHeight: 1.05,
                fontWeight: 400,
                letterSpacing: "-0.01em",
              }}
            >
              <span>Your Idle Crypto Is </span>
              <span className="text-[#c9f352]" style={{ fontWeight: 500 }}>
                Bleeding
              </span>
            </h1>

            <p
              className="m-0 max-w-[760px] text-center text-white"
              style={{
                fontSize: "clamp(14px, 1.2vw, 19px)",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              <span>Every day your stablecoins sit idle, </span>
              <span style={{ fontWeight: 700 }}>they bleed value</span>
              <span>
                . Connect your wallet and find out exactly how much you've
                already lost —{" "}
              </span>
              <span className="text-[#c9f352]" style={{ fontWeight: 700 }}>
                then fix it in one click.
              </span>
            </p>
          </div>

          {/* CTA group */}
          <div className="flex w-full flex-col items-center gap-6">
            {/* Input row */}
            <form
              onSubmit={handleScan}
              className="flex w-full max-w-[576px] items-center gap-[10px] border border-[#696969] bg-[#0e0e0e] p-[6px]"
            >
              <div className="flex flex-1 items-center px-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Paste a Wallet Address to Scan"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-transparent text-[20px] text-white placeholder:text-white/90 outline-none"
                  style={{ fontWeight: 400 }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !value.trim()}
                className="flex shrink-0 items-center justify-center gap-2 bg-[#c9f352] px-4 py-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="5.5"
                    stroke="black"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M13 13L17 17"
                    stroke="black"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="whitespace-nowrap text-[20px] text-black"
                  style={{ fontWeight: 500 }}
                >
                  {submitting ? "Scanning..." : "Scan"}
                </span>
              </button>
            </form>

            {error && (
              <p className="m-0 text-center text-[13px] text-red-400">
                {error}
              </p>
            )}

            {/* OR divider */}
            <div className="flex items-center justify-center gap-6">
              <div className="h-px w-[130px] bg-[#696969]" />
              <span
                className="text-[13px] text-white"
                style={{ fontWeight: 500 }}
              >
                OR
              </span>
              <div className="h-px w-[130px] bg-[#696969]" />
            </div>

            {/* Connect Wallet outline button */}
            <button
              type="button"
              onClick={handleConnectWallet}
              className="flex items-center justify-center border border-[#c9f352] px-6 py-4 transition-colors hover:bg-[rgba(201,243,82,0.09)]"
            >
              <span
                className="whitespace-nowrap text-[20px] text-[#c9f352]"
                style={{ fontWeight: 700 }}
              >
                {ready && authenticated ? "Scan My Wallet" : "Connect Wallet"}
              </span>
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-x-[120px] gap-y-10 text-white">
            <StatBlock value="$2.3M" label="Lost to dead money" />
            <StatBlock value="4,200+" label="Wallets revived" />
            <StatBlock value="1023%" label="Best APY right now" />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[5px]">
      <p
        className="m-0 whitespace-nowrap text-white"
        style={{
          fontSize: "clamp(32px, 3.3vw, 52px)",
          fontWeight: 400,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p
        className="m-0 whitespace-nowrap text-center text-[14px] capitalize text-white"
        style={{
          fontWeight: 500,
          letterSpacing: "0.7px",
          lineHeight: "normal",
        }}
      >
        {label}
      </p>
    </div>
  );
}
