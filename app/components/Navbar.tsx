import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePrivy } from "@privy-io/react-auth";

export function Navbar() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const navigate = useNavigate();

  const walletAddress =
    user?.wallet?.address ??
    user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ??
    null;

  async function handleDisconnect() {
    try {
      await logout();
    } catch {
      // noop
    }
  }

  const isConnected = ready && authenticated && !!walletAddress;

  return (
    <nav className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-[#373737] bg-[#020313]/80 backdrop-blur-md px-4 sm:px-6 py-3">
      <Link to="/" className="flex items-center gap-3 p-[10px]">
        <img src="/logo-text.svg" alt="" className="h-full w-44" />
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        {isConnected && (
          <>
            <button
              type="button"
              onClick={() => navigate(`/scan/${walletAddress}`)}
              className="hidden sm:inline-flex items-center border border-[#c9f352]/40 bg-[#c9f352]/10 px-3 py-2 text-[13px] font-bold text-[#c9f352] transition-colors hover:bg-[#c9f352]/20"
            >
              My Report
            </button>
            <button
              type="button"
              onClick={() => navigate("/deposits")}
              className="hidden sm:inline-flex items-center border border-[#c9f352]/40 bg-[#c9f352]/10 px-3 py-2 text-[13px] font-bold text-[#c9f352] transition-colors hover:bg-[#c9f352]/20"
           >
              My Investments
            </button>
          </>
        )}
        <WalletButton
          ready={ready}
          authenticated={authenticated}
          address={walletAddress}
          onConnect={login}
          onDisconnect={handleDisconnect}
          onViewReport={() => walletAddress && navigate(`/scan/${walletAddress}`)}
          onViewInvestments={() => navigate("/deposits")}
        />
      </div>
    </nav>
  );
}

function WalletButton({
  ready,
  authenticated,
  address,
  onConnect,
  onDisconnect,
  onViewReport,
  onViewInvestments,
}: {
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void | Promise<void>;
  onViewReport: () => void;
  onViewInvestments: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
  }, [open]);

  if (!ready) {
    return <div className="h-[34px] w-[140px]" aria-hidden />;
  }

  if (!authenticated || !address) {
    return (
      <button
        type="button"
        onClick={onConnect}
        className="border border-[#c9f352] px-4 py-2 text-[14px] font-bold text-[#c9f352] transition-colors hover:bg-[rgba(201,243,82,0.09)]"
      >
        Connect Wallet
      </button>
    );
  }

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-[#696969] bg-[#0e0e0e] px-3 py-2 font-mono text-[13px] text-white transition-colors hover:border-[#c9f352]"
      >
        <span className="h-2 w-2 rounded-full bg-[#c9f352]" />
        {short}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] border border-[#2a2a3a] bg-[#0e0e0e] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
          <div className="mb-3 border-b border-[#1e1e2c] pb-3">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-[#5a5a6a]">
              Connected
            </p>
            <p className="break-all font-mono text-[12px] text-white">{address}</p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center justify-between px-2 py-2 text-left text-[13px] text-[#9898a8] transition-colors hover:bg-[#1a1a24] hover:text-white"
          >
            <span>{copied ? "Copied!" : "Copy address"}</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect
                x="4"
                y="4"
                width="9"
                height="9"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M11 4V3H3v9h1"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onViewInvestments();
            }}
            className="flex w-full items-center justify-between px-2 py-2 text-left text-[13px] text-[#9898a8] transition-colors hover:bg-[#1a1a24] hover:text-white sm:hidden"
          >
            <span>My investments</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 12l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onViewReport();
            }}
            className="flex w-full items-center justify-between px-2 py-2 text-left text-[13px] text-[#9898a8] transition-colors hover:bg-[#1a1a24] hover:text-white sm:hidden"
          >
            <span>View my report</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3h7v7M13 3L5 11"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await onDisconnect();
            }}
            className="mt-2 flex w-full items-center justify-between border-t border-[#1e1e2c] px-2 pb-1 pt-3 text-left text-[13px] text-[#ff6b6b] transition-colors hover:text-[#ff8888]"
          >
            <span>Disconnect</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 11l3-3-3-3M13 8H6M8 13H3V3h5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}