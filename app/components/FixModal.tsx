import { useEffect, useState, useMemo } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import confetti from "canvas-confetti";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSendTransaction, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { createWalletClient, custom } from "viem";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";
import { erc20Abi } from "viem";
import type { IdleAsset } from "~/lib/deadMoney";
import { formatUsd, formatApy } from "~/lib/deadMoney";
import { useComposerQuote } from "~/hooks/useComposerQuote";
import { getGasEstimateUsd } from "~/lib/composerApi";
import { cn } from "~/lib/utils";
import { CHAIN_NAMES } from "~/lib/tokens";
import { getVaultUrl } from "~/lib/earnApi";

type ModalState = "loading" | "ready" | "submitting" | "success" | "error";

interface FixModalProps {
  asset: IdleAsset;
  onClose: () => void;
  onFixed: () => void;
}

export function FixModal({ asset, onClose, onFixed }: FixModalProps) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  
  const { isLoading: isWaitingForApproval } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: asset.token.chainId,
  });

  const [modalState, setModalState] = useState<ModalState>(authenticated ? "loading" : "ready");
  const [txError, setTxError] = useState<string | null>(null);

  const userAddress = wallets?.[0]?.address ?? null;
  const vault = asset.bestVault;

  const amountNeeded = useMemo(() => {
    return BigInt(Math.floor(asset.balance * Math.pow(10, asset.token.decimals)));
  }, [asset.balance, asset.token.decimals]);

  // Refetch allowance when approval tx is confirmed
  useEffect(() => {
    if (approveHash && !isWaitingForApproval) {
      refetchAllowance();
    }
  }, [approveHash, isWaitingForApproval]);

  const CHAIN_MAP: Record<number, Chain> = { 1: mainnet, 8453: base, 42161: arbitrum, 10: optimism, 137: polygon };

  // Helper: switch wallet to the right chain then return a viem client
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
        fromChain: asset.token.chainId,
        toChain: asset.token.chainId,
        fromToken: asset.token.address,
        toToken: vault.address,
        fromAddress: userAddress,
        toAddress: userAddress,
        fromAmount: amountNeeded.toString(),
      }
    : null), [authenticated, userAddress, vault, asset.token.chainId, asset.token.address, amountNeeded]);

  const { quote, status: quoteStatus, error: quoteError } = useComposerQuote(quoteParams);

  // Allowance check
  const isNative = asset.token.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const spender = quote?.estimate?.approvalAddress;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: asset.token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    chainId: asset.token.chainId,
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
    if (quoteParams) {
      console.log("[FixModal] quoteParams:", quoteParams);
    }
  }, [JSON.stringify(quoteParams)]);

  useEffect(() => {
    console.log("[FixModal] quote status:", quoteStatus, "error:", quoteError);
    if (quote) {
      console.log("[FixModal] quote fetched successfully:", quote.id, "tool:", quote.tool, "approvalAddress:", quote.estimate?.approvalAddress);
    }
  }, [quote, quoteStatus, quoteError]);

  useEffect(() => {
    if (!authenticated) return;
    if (quoteStatus === "loading") setModalState("loading");
    else if (quoteStatus === "done") setModalState("ready");
    else if (quoteStatus === "error") setModalState("ready");
  }, [quoteStatus, authenticated]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleApprove() {
    if (!spender) return;
    setIsApproving(true);
    setTxError(null);
    try {
      const client = await getWalletClientForChain(asset.token.chainId);
      const hash = await client.writeContract({
        address: asset.token.address as `0x${string}`,
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

  async function handleDeposit() {
    if (!quote) return;
    setModalState("submitting");
    setTxError(null);
    try {
      const tx = quote.transactionRequest;
      const client = await getWalletClientForChain(tx.chainId ?? asset.token.chainId);
      await client.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
      });
      setModalState("success");
      confetti({ particleCount: 60, spread: 80, colors: ["#7C3AED", "#00D4AA", "#F0F0F5"], origin: { x: 0.5, y: 0.5 } });
      setTimeout(onFixed, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(msg.toLowerCase().includes("user rejected") ? "Transaction cancelled." : msg.slice(0, 120));
      setModalState("error");
    }
  }

  const totalApy = formatApy(asset.bestApy);
  const yearlyEarnings = formatUsd(asset.yearlyLossUsd);
  const gasEstimate = quote ? getGasEstimateUsd(quote) : "~$2.00";
  const chainName = CHAIN_NAMES[asset.token.chainId as keyof typeof CHAIN_NAMES] ?? String(asset.token.chainId);
  const vaultUrl = vault ? getVaultUrl(vault) : "https://app.li.fi/earn";

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
        <div className="bg-gradient-to-r from-purple-950/50 to-[#1a1a24] px-6 py-5 border-b border-[#2a2a3a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
              <img src={asset.token.logoUrl} alt={asset.token.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div>
              <h2 className="font-semibold text-[#f0f0f5] text-lg">Fix Your {asset.token.symbol}</h2>
              <p className="text-xs text-[#9898a8]">Deposit into {vault?.name ?? "best vault"}</p>
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
              <h3 className="text-xl font-bold text-[#f0f0f5] mb-2">You're now earning! 🎉</h3>
              <p className="text-[#9898a8] text-sm">
                Your {asset.token.symbol} is earning <span className="text-[#00d4aa] font-semibold">{totalApy} APY</span> in {vault?.name}. That's +{yearlyEarnings}/year.
              </p>
            </div>
          ) : (
            <>
              {/* Vault card */}
              {vault && (
                <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <a href={vaultUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#a78bfa] hover:text-white underline underline-offset-2 cursor-pointer">
                {vault.name} ↗
              </a>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20 text-[#00d4aa]">Verified</span>
                    </div>
                    <span className="font-mono font-black text-[#00d4aa] text-xl">{totalApy}</span>
                  </div>
                  {modalState === "loading" ? (
                    <div className="space-y-2">
                      <div className="skeleton h-3 rounded w-full" />
                      <div className="skeleton h-3 rounded w-3/4" />
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-[#9898a8]">
                      {vault.analytics?.apy?.base != null && (
                        <div className="flex justify-between"><span>Base yield</span><span className="text-[#f0f0f5] font-mono">{vault.analytics.apy.base.toFixed(1)}%</span></div>
                      )}
                      {vault.analytics?.apy?.reward != null && vault.analytics.apy.reward > 0 && (
                        <div className="flex justify-between"><span>Reward tokens</span><span className="text-[#f0f0f5] font-mono">{vault.analytics.apy.reward.toFixed(1)}%</span></div>
                      )}
                      <div className="border-t border-[#2a2a3a] my-1" />
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#f0f0f5]">Total APY</span>
                        <span className="text-[#00d4aa] font-mono">{totalApy}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Deposit details */}
              <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4">
                {modalState === "loading" ? (
                  <div className="skeleton h-12 rounded w-full" />
                ) : (
                  <>
                    <p className="text-xs text-[#5a5a6a] uppercase tracking-wider mb-3">Your Deposit</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-mono text-xl font-bold text-[#f0f0f5]">
                          {asset.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {asset.token.symbol}
                        </p>
                        <p className="text-sm text-[#9898a8]">{formatUsd(asset.usdValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#5a5a6a]">You'll earn yearly</p>
                        <p className="font-mono text-lg font-bold text-[#00d4aa]">+{yearlyEarnings}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Gas + network */}
              <div className="flex items-center justify-between text-xs text-[#5a5a6a] px-1">
                <span>Network: {chainName}</span>
                <span>Gas estimate: {gasEstimate}</span>
              </div>

              {/* LI.FI route */}
              <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3">
                <p className="text-xs text-purple-300 font-medium mb-1.5">Powered by LI.FI Composer</p>
                <div className="flex items-center gap-2 text-xs text-[#9898a8]">
                  <span className="font-mono">{asset.token.symbol}</span>
                  <span>→</span>
                  <span className="text-[#f0f0f5]">
                    {typeof vault?.protocol === "string" 
                      ? vault.protocol 
                      : (vault?.protocol as any)?.name ?? "LI.FI"}
                  </span>
                  <span>→</span>
                  <span className="text-[#00d4aa] font-mono">{vault?.name}</span>
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
                className="cursor-pointer w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 shadow-[0_0_32px_rgba(124,58,237,0.25)] transition-all active:scale-[0.98]"
              >
                Connect Wallet to Fix This
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
                  <><Lock className="w-4 h-4" />Approve {asset.token.symbol}</>
                )}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={modalState === "loading" || modalState === "submitting" || !quote}
                className="cursor-pointer w-full h-14 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 shadow-[0_0_32px_rgba(124,58,237,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {modalState === "submitting" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Confirming in wallet...</>
                ) : modalState === "loading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Getting best quote...</>
                ) : (
                  `Deposit Now — Earn ${totalApy} APY`
                )}
              </button>
            )}
            <p className="text-center text-xs text-[#5a5a6a] mt-3">Withdrawable anytime. No lockups.</p>
          </div>
        )}
      </div>
    </div>
  );
}
