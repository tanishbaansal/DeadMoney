import { Link } from "react-router";
import { usePrivy } from "@privy-io/react-auth";

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Navbar() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const walletAddress =
    user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet")?.address ?? null;

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[#1e1e2c] h-16 flex items-center justify-between px-6">
      <Link
        to="/"
        className="font-mono font-bold text-[#f0f0f5] text-lg hover:text-white transition-colors"
      >
        💀 Dead Money
      </Link>

      <div className="flex items-center gap-3">
        {!ready ? null : authenticated && walletAddress ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#9898a8] bg-[#22222e] border border-[#2a2a3a] px-3 py-1.5 rounded-lg">
              {shortenAddr(walletAddress)}
            </span>
            <Link
              to="/deposits"
              className="text-sm font-medium text-[#9898a8] hover:text-[#f0f0f5] transition-colors"
            >
              My Investments
            </Link>
            <Link
              to={`/scan/${walletAddress}`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#7c3aed] hover:bg-purple-500 text-white transition-colors"
            >
              My Report
            </Link>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg text-xs text-[#5a5a6a] hover:text-[#9898a8] border border-[#1e1e2c] hover:border-[#2a2a3a] transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#2a2a3a] text-[#9898a8] hover:text-[#f0f0f5] hover:border-[#3a3a4e] transition-all duration-200"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
