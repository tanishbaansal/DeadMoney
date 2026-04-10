"use client";
import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSendTransaction } from "wagmi";
import type { IdleAsset } from "~/lib/deadMoney";
import { formatUsd, formatApy } from "~/lib/deadMoney";
import { useComposerQuote } from "~/hooks/useComposerQuote";
import { getGasEstimateUsd } from "~/lib/composerApi";
import { cn } from "~/lib/utils";

type ModalState = "loading" | "ready" | "submitting" | "success" | "error";

interface FixModalProps {
  asset: IdleAsset;
  onClose: () => void;
  onFixed: () => void;
}

export function FixModal({ asset, onClose, onFixed }: FixModalProps) {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransactionAsync } = useSendTransaction();
  const [modalState, setModalState] = useState<ModalState>("loading");
  const [txError, setTxError] = useState<string | null>(null);

  const userAddress = wallets?.[0]?.address ?? user?.wallet?.address ?? null;

  // Build quote params — only if wallet connected and vault exists
  const quoteParams =
    authenticated && userAddress && asset.bestVault
      ? {
          fromChain: asset.token.chainId,
          toChain: asset.token.chainId,
          fromToken: asset.token.address,
          toToken: asset.bestVault.address,
          fromAddress: userAddress,
          toAddress: userAddress,
          fromAmount: BigInt(
            Math.floor(asset.balance * Math.pow(10, asset.token.decimals))
          ).toString(),
        }
      : null;

  const { quote, status: quoteStatus, error: quoteError } = useComposerQuote(quoteParams);

  useEffect(() => {
    if (!authenticated) { setModalState("ready"); return; }
    if (quoteStatus === "loading") setModalState("loading");
    else if (quoteStatus === "done" && quote) setModalState("ready");
    else if (quoteStatus === "error") setModalState("ready"); // show with error
  }, [quoteStatus, quote, authenticated]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleDeposit() {
    if (!quote) return;
    setModalState("submitting");
    setTxError(null);

    try {
      const tx = quote.transactionRequest;
      await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
        chainId: tx.chainId,
      });

      setModalState("success");
      confetti({
        particleCount: 60,
        spread: 80,
        colors: ["#7C3AED", "#00D4AA", "#F0F0F5"],
        origin: { x: 0.5, y: 0.5 },
      });

      setTimeout(onFixed, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(msg.includes("user rejected") ? "Transaction cancelled." : msg.slice(0, 100));
      setModalState("error");
    }
  }

  const vault = asset.bestVault!;
  const yearlyEarnings = formatUsd(asset.yearlyLossUsd);
  const gasEstimate = quote ? getGasEstimateUsd(quote) : "~$2.00";
  const baseApy = vault.analytics?.apy?.base ?? null;
  const rewardApy = vault.analytics?.apy?.reward ?? null;
  const totalApy = formatApy(asset.bestApy);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full bg-[#1a1a24] border border-[#2a2a3a]",
          "sm:max-w-lg sm:rounded-3xl",
          "rounded-t-3xl shadow-[0_24px_64px_rgba(0,0,0,0.5),0_0_0_1px_#2a2a3a]",
          "overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950/50 to-[#1a1a24] px-6 py-5 border-b border-[#2a2a3a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <img
                  src={asset.token.logoUrl}
                  alt={asset.token.symbol}
                  className="w-6 h-6 rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div>
                <h2 className="font-semibold text-[#f0f0f5] text-lg">Fix Your {asset.token.symbol}</h2>
                <p className="text-xs text-[#9898a8]">Deposit into {vault.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#22222e] hover:bg-[#2a2a3a] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-[#9898a8]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Success state */}
          {modalState === "success" && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-[#00d4aa] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#f0f0f5] mb-2">You're now earning! 🎉</h3>
              <p className="text-[#9898a8] text-sm">
                Your {asset.token.symbol} is earning <span className="text-[#00d4aa] font-semibold">{totalApy} APY</span>
                {" "}in {vault.name}. That's +{yearlyEarnings}/year.
              </p>
            </div>
          )}

          {modalState !== "success" && (
            <>
              {/* Vault card */}
              <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#f0f0f5]">{vault.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa]">
                      Verified
                    </span>
                  </div>
                  <span className="font-mono font-black text-[#00d4aa] text-xl">{totalApy}</span>
                </div>

                {modalState === "loading" ? (
                  <div className="space-y-2">
                    <div className="skeleton h-3 rounded w-full" />
                    <div className="skeleton h-3 rounded w-3/4" />
                    <div className="skeleton h-3 rounded w-1/2" />
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs text-[#9898a8]">
                    {baseApy != null && (
                      <div className="flex justify-between">
                        <span>Base yield</span>
                        <span className="text-[#f0f0f5] font-mono">{baseApy.toFixed(1)}%</span>
                      </div>
                    )}
                    {rewardApy != null && rewardApy > 0 && (
                      <div className="flex justify-between">
                        <span>Reward tokens</span>
                        <span className="text-[#f0f0f5] font-mono">{rewardApy.toFixed(1)}%</span>
                      </div>
                    )}
                    <div className="border-t border-[#2a2a3a] my-1" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-[#f0f0f5]">Total APY</span>
                      <span className="text-[#00d4aa] font-mono">{totalApy}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Deposit details */}
              {modalState === "loading" ? (
                <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4">
                  <div className="skeleton h-4 rounded w-1/2 mb-3" />
                  <div className="skeleton h-8 rounded w-3/4" />
                </div>
              ) : (
                <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4">
                  <p className="text-xs text-[#5a5a6a] uppercase tracking-wider mb-3">Your Deposit</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-mono text-xl font-bold text-[#f0f0f5]">
                        {asset.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })} {asset.token.symbol}
                      </p>
                      <p className="text-sm text-[#9898a8]">{formatUsd(asset.usdValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#5a5a6a]">You'll earn yearly</p>
                      <p className="font-mono text-lg font-bold text-[#00d4aa]">+{yearlyEarnings}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Gas + route */}
              <div className="flex items-center justify-between text-xs text-[#5a5a6a] px-1">
                <span>Network: {vault.chainId === 1 ? "Ethereum" : vault.chainId === 8453 ? "Base" : vault.chainId === 42161 ? "Arbitrum" : "Optimism"}</span>
                <span>Gas estimate: {gasEstimate}</span>
              </div>

              <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3">
                <p className="text-xs text-purple-300 font-medium mb-1.5">Powered by LI.FI Composer</p>
                <div className="flex items-center gap-2 text-xs text-[#9898a8]">
                  <span className="font-mono">{asset.token.symbol}</span>
                  <span>→</span>
                  <span className="text-[#f0f0f5]">{vault.protocol}</span>
                  <span>→</span>
                  <span className="text-[#00d4aa] font-mono">{vault.name}</span>
                </div>
              </div>

              {/* Error */}
              {(txError || quoteError) && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{txError ?? quoteError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        {modalState !== "success" && (
          <div className="px-6 pb-6 pt-0">
            {!authenticated ? (
              <button
                onClick={login}
                className="w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 shadow-[0_0_32px_rgba(124,58,237,0.25)] transition-all active:scale-[0.98]"
              >
                Connect Wallet to Fix This
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={modalState === "loading" || modalState === "submitting" || !quote}
                className={cn(
                  "w-full h-14 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98]",
                  "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500",
                  "shadow-[0_0_32px_rgba(124,58,237,0.25)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                  "flex items-center justify-center gap-2"
                )}
              >
                {modalState === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming in wallet...
                  </>
                ) : modalState === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Getting best quote...
                  </>
                ) : (
                  `Deposit Now — Earn ${totalApy} APY`
                )}
              </button>
            )}
            <p className="text-center text-xs text-[#5a5a6a] mt-3">
              Withdrawable anytime. No lockups.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
