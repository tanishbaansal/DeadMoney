import { useEffect, useState, useMemo } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, ArrowLeftRight } from "lucide-react";
import confetti from "canvas-confetti";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { createWalletClient, custom, parseUnits } from "viem";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";
import { erc20Abi } from "viem";
import type { Position } from "~/lib/earnApi";
import { formatUsd, formatApy } from "~/lib/deadMoney";
import { useComposerQuote } from "~/hooks/useComposerQuote";
import { getGasEstimateUsd } from "~/lib/composerApi";
import { getPublicClient } from "~/lib/viem";
import { cn } from "~/lib/utils";
import { CHAIN_NAMES } from "~/lib/tokens";

type ModalState = "loading" | "ready" | "submitting" | "success" | "error";

interface WithdrawModalProps {
  position: Position;
  onClose: () => void;
  onWithdrawn: () => void;
}

export function WithdrawModal({ position, onClose, onWithdrawn }: WithdrawModalProps) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  
  const { isLoading: isWaitingForApproval } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: position.chainId,
  });

  const [modalState, setModalState] = useState<ModalState>(authenticated ? "loading" : "ready");
  const [txError, setTxError] = useState<string | null>(null);

  const userAddress = wallets?.[0]?.address ?? null;
  const vault = position.vault;

  const amountNeeded = useMemo(() => {
    return parseUnits(position.stakedTokenAmount, position.vault.decimals || 18);
  }, [position.stakedTokenAmount, position.vault.decimals]);

  // Refetch allowance when approval tx is confirmed
  useEffect(() => {
    if (approveHash && !isWaitingForApproval) {
      refetchAllowance();
    }
  }, [approveHash, isWaitingForApproval]);

  const CHAIN_MAP: Record<number, Chain> = { 1: mainnet, 8453: base, 42161: arbitrum, 10: optimism, 137: polygon };

  async function getWalletClientForChain(chainId: number) {
    const wallet = wallets[0];
    if (!wallet) throw new Error("No wallet connected");
    await wallet.switchChain(chainId);
    const provider = await wallet.getEthereumProvider();
    const chain = CHAIN_MAP[chainId];
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
    return createWalletClient({
      account: userAddress as `0x${string}`,
      chain,
      transport: custom(provider),
    });
  }

  const quoteParams = useMemo(() => (authenticated && userAddress && vault
    ? {
        fromChain: position.chainId,
        toChain: position.chainId,
        fromToken: vault.address, // Withdraw FROM vault
        toToken: vault.asset,     // TO underlying asset
        fromAddress: userAddress,
        toAddress: userAddress,
        fromAmount: amountNeeded.toString(),
      }
    : null), [authenticated, userAddress, vault, position.chainId, amountNeeded]);

  const { quote, status: quoteStatus, error: quoteError } = useComposerQuote(quoteParams);

  const isNative = vault.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const spender = quote?.estimate?.approvalAddress;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: vault.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    chainId: position.chainId,
    args: userAddress && spender ? [userAddress as `0x${string}`, spender as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!spender && !isNative,
    }
  });

  const needsApproval = useMemo(() => {
    if (isNative) return false;
    if (!allowance) return true;
    return (allowance as bigint) < amountNeeded;
  }, [isNative, allowance, amountNeeded]);

  useEffect(() => {
    if (authenticated) {
      if (quoteStatus === "loading") setModalState("loading");
      else if (quoteStatus === "done") setModalState("ready");
      else if (quoteStatus === "error") setModalState("ready");
    }
  }, [quoteStatus, authenticated]);

  async function handleApprove() {
    if (!spender) return;
    setIsApproving(true);
    setTxError(null);
    try {
      const client = await getWalletClientForChain(position.chainId);
      const hash = await client.writeContract({
        address: vault.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, amountNeeded],
      });
      setApproveHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setTxError(msg.slice(0, 120));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleWithdraw() {
    if (!quote) return;
    setModalState("submitting");
    setTxError(null);
    try {
      const tx = quote.transactionRequest;
      const walletClient = await getWalletClientForChain(tx.chainId ?? position.chainId);
      const publicClient = getPublicClient((tx.chainId ?? position.chainId) as any);

      console.log("[WithdrawModal] Executing withdrawal:", {
        to: tx.to,
        fromAddress: userAddress,
        amount: amountNeeded.toString(),
        gasPrice: tx.gasPrice
      });

      let gasLimit: bigint;
      try {
        // Use public client for estimation
        const gasEstimate = await publicClient.estimateGas({
          account: userAddress as `0x${string}`,
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value ?? "0"),
        });
        gasLimit = (gasEstimate * 140n) / 100n; // 40% margin for Polygon stability
      } catch (estimateErr) {
        console.warn("[WithdrawModal] Local estimateGas failed, using fallback:", estimateErr);
        if (tx.gasLimit) {
           // Provide 20% buffer on top of LI.FI's estimate
           gasLimit = (BigInt(tx.gasLimit) * 120n) / 100n;
        } else {
           gasLimit = 2000000n; // Safe fallback for complex cross-chain calls
        }
      }

      await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
        gas: gasLimit,
      });
      setModalState("success");
      confetti({ particleCount: 60, spread: 80, colors: ["#7C3AED", "#00D4AA", "#F0F0F5"], origin: { x: 0.5, y: 0.5 } });
      setTimeout(onWithdrawn, 2500);
    } catch (err) {
      console.error("[WithdrawModal] Transaction failed:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      
      let displayError = msg.slice(0, 120);
      if (msg.toLowerCase().includes("user rejected")) {
        displayError = "Transaction cancelled.";
      } else if (msg.toLowerCase().includes("reverted")) {
        displayError = "Execution reverted. This often happens if the balance/allowance is insufficient or the amount is slightly off. Try withdrawing a tiny bit less.";
      }
      
      setTxError(displayError);
      setModalState("error");
    }
  }

  const gasEstimate = quote ? getGasEstimateUsd(quote) : "~$2.00";
  const chainName = CHAIN_NAMES[position.chainId as keyof typeof CHAIN_NAMES] ?? String(position.chainId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      <div className={cn(
        "relative z-10 w-full bg-[#1a1a24] border border-[#2a2a3a]",
        "sm:max-w-lg sm:rounded-3xl rounded-t-3xl",
        "shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden"
      )}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950/30 to-[#1a1a24] px-6 py-5 border-b border-[#2a2a3a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
              <ArrowLeftRight className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-[#f0f0f5] text-lg">Withdraw Asset</h2>
              <p className="text-xs text-[#9898a8]">Exiting {vault.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer w-8 h-8 rounded-full bg-[#22222e] hover:bg-[#2a2a3a] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-[#9898a8]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {modalState === "success" ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-[#00d4aa] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#f0f0f5] mb-2">Withdrawal Initiated! 💸</h3>
              <p className="text-[#9898a8] text-sm">
                Your funds are being returned to your wallet. High-five for securing your gains!
              </p>
            </div>
          ) : (
            <>
              {/* Withdrawal details */}
              <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4 text-center">
                <p className="text-xs text-[#5a5a6a] uppercase tracking-wider mb-2">You are withdrawing</p>
                <p className="font-mono text-3xl font-bold text-[#f0f0f5]">
                  {parseFloat(position.stakedTokenAmount).toFixed(4)}
                </p>
                <p className="text-sm text-[#9898a8] mt-1">{formatUsd(position.stakedTokenAmountUsd)}</p>
              </div>

              {/* Gas + network */}
              <div className="flex items-center justify-between text-xs text-[#5a5a6a] px-1">
                <span>Network: {chainName}</span>
                <span>Gas estimate: {gasEstimate}</span>
              </div>

              {/* LI.FI route */}
              <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3">
                <p className="text-xs text-purple-300 font-medium mb-1.5 font-bold">Withdrawal Route</p>
                <div className="flex items-center gap-2 text-xs text-[#9898a8]">
                  <span className="text-[#00d4aa] font-mono font-bold">{vault.name}</span>
                  <span>→</span>
                  <span className="text-[#f0f0f5]">LI.FI Composer</span>
                  <span>→</span>
                  <span className="font-mono">{vault.asset.slice(0, 6)}...{vault.asset.slice(-4)}</span>
                </div>
              </div>

              {/* Error */}
              {(txError || (modalState === "error" && quoteError)) && (
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
                className="cursor-pointer w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 shadow-[0_0_32px_rgba(220,38,38,0.25)] transition-all active:scale-[0.98]"
              >
                Connect Wallet
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={modalState === "loading" || isApproving || isWaitingForApproval || !quote}
                className="cursor-pointer w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-[#00b492] to-[#00d4aa] hover:from-[#00d4aa] shadow-[0_0_32px_rgba(0,212,170,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Confirming in wallet...</>
                ) : isWaitingForApproval ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Waiting for network...</>
                ) : (
                  <>Continue to Withdrawal</>
                )}
              </button>
            ) : (
              <button
                onClick={handleWithdraw}
                disabled={modalState === "loading" || modalState === "submitting" || !quote}
                className="cursor-pointer w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 shadow-[0_0_32px_rgba(220,38,38,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {modalState === "submitting" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Confirming in wallet...</>
                ) : modalState === "loading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Getting best quote...</>
                ) : (
                  `Execute Withdrawal`
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
