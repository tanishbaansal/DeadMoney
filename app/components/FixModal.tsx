import { useEffect, useState, useMemo, useRef } from "react";
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
  const autoDepositHashRef = useRef<`0x${string}` | null>(null);
  
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
      autoDepositHashRef.current = null;
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
      setTimeout(onFixed, 5000);
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

  // One-click flow: once approval is confirmed and allowance updates, auto-start deposit.
  useEffect(() => {
    if (!approveHash || isWaitingForApproval) return;
    if (!quote || needsApproval) return;
    if (modalState !== "ready" && modalState !== "error") return;
    if (autoDepositHashRef.current === approveHash) return;

    autoDepositHashRef.current = approveHash;
    void handleDeposit();
  }, [approveHash, isWaitingForApproval, quote, needsApproval, modalState, handleDeposit]);
  const vaultUrl = vault ? getVaultUrl(vault) : "https://app.li.fi/earn";

  const baseApy = vault?.analytics?.apy?.base;
  const rewardApy = vault?.analytics?.apy?.reward;
  const protocolName =
    typeof vault?.protocol === "string"
      ? vault.protocol
      : (vault?.protocol as any)?.name ?? "LI.FI";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      <div className={cn(
        "relative z-10 w-full sm:max-w-[520px]",
        "rounded-t-[20px] sm:rounded-[20px] overflow-hidden",
        "",
        "shadow-[0px_2px_12px_0px_rgba(73,73,73,0.25)]",
        "backdrop-blur-[37.65px]",
        "bg-[linear-gradient(180deg,rgba(14,11,20,0.92)_0%,rgba(31,9,69,0.78)_45%,rgba(14,11,20,0.92)_100%)]",
      )}>
        <div className="flex flex-col gap-5 px-6 pt-6 pb-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#22222e] shrink-0 flex items-center justify-center">
                <img
                  src={asset.token.logoUrl}
                  alt={asset.token.symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex flex-col gap-1 justify-center min-w-0">
                <h2 className="font-medium text-white text-[20px] leading-none tracking-[0.6px] capitalize truncate">
                  Fix Your {asset.token.symbol}
                </h2>
                <p className="text-[#cacaca] text-[12px] tracking-[0.4px] capitalize truncate">
                  Deposit into {vault?.name ?? "best"} vault
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer shrink-0 w-7 h-7 flex items-center justify-center text-[#cacaca] hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          {modalState === "success" ? (
            <div className="rounded-[10px] bg-[rgba(14,11,20,0.67)] backdrop-blur-[37.65px] p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#00a888] mx-auto mb-3" />
              <p className="text-white text-[16px] font-medium mb-1.5">You're now earning!</p>
              <p className="text-[#cacaca] text-[12px]">
                Your {asset.token.symbol} is earning <span className="text-[#00a888] font-semibold">{totalApy} APY</span> in {vault?.name}. That's +{yearlyEarnings}/year.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Vault APY card */}
              {vault && (
                <div className="rounded-[10px] bg-[rgba(14,11,20,0.67)] backdrop-blur-[37.65px] p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <a
                          href={vaultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#c9f352] text-[16px] tracking-[0.6px] uppercase underline truncate hover:text-[#d4ff5e]"
                        >
                          {asset.token.symbol}
                        </a>
                        <span className="shrink-0 px-2.5 py-1 rounded-[4px] bg-[rgba(16,185,129,0.13)] text-[#00a888] text-[10px] font-bold tracking-[0.6px] uppercase">
                          Verified
                        </span>
                      </div>
                      <span className="text-[#00a888] text-[16px] font-medium tracking-[0.6px] uppercase whitespace-nowrap">
                        {totalApy}
                      </span>
                    </div>

                    {modalState === "loading" ? (
                      <div className="space-y-2">
                        <div className="skeleton h-3 rounded w-full" />
                        <div className="skeleton h-3 rounded w-3/4" />
                      </div>
                    ) : (
                      <>
                        {baseApy != null && (
                          <div className="flex justify-between items-center text-[#cacaca] text-[13px]">
                            <span>Base Yield</span>
                            <span>{baseApy.toFixed(1)}%</span>
                          </div>
                        )}
                        {rewardApy != null && rewardApy > 0 && (
                          <div className="flex justify-between items-center text-[#cacaca] text-[13px]">
                            <span>Reward tokens</span>
                            <span>{rewardApy.toFixed(1)}%</span>
                          </div>
                        )}
                        <div className="border-t border-[#373737] pt-3 flex justify-between items-center text-[14px]">
                          <span className="text-white">Total APY</span>
                          <span className="text-[#00a888]">{totalApy}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Deposit card */}
              <div className="rounded-[10px] bg-[rgba(14,11,20,0.67)] backdrop-blur-[37.65px] p-4 flex flex-col gap-3">
                <p className="text-[#cacaca] text-[11px] font-medium tracking-[0.4px] uppercase">
                  Your Deposit
                </p>
                {modalState === "loading" ? (
                  <div className="skeleton h-10 rounded w-full" />
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 text-[20px] font-medium tracking-[0.6px] uppercase">
                      <p className="text-white truncate">
                        {asset.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {asset.token.symbol}
                      </p>
                      <p className="text-[#00a888] whitespace-nowrap">+{yearlyEarnings}</p>
                    </div>
                    <div className="flex items-start justify-between text-[#cacaca] text-[12px]">
                      <p>{formatUsd(asset.usdValue)}</p>
                      <p>You'll Earn Yearly</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Network / gas */}
              <div className="flex items-center justify-between py-1 text-[#cacaca] text-[12px] tracking-[0.4px] capitalize">
                <span>Network: {chainName}</span>
                <span>Gas Estimate: {gasEstimate}</span>
              </div>

              {/* LI.FI route */}
              <div
                className="rounded-[10px] backdrop-blur-[37.65px] p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(98.47deg, rgba(14, 11, 20, 0.67) 1%, rgba(31, 9, 69, 0.67) 45%, rgba(14, 11, 20, 0.67) 100%)",
                }}
              >
                <div className="flex flex-col gap-2">
                  <p className="text-[#cacaca] text-[11px] font-medium tracking-[0.4px] uppercase">
                    Powered by LI.FI Composer
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] tracking-[0.4px] capitalize">
                    <span className="text-[#cacaca]">{asset.token.symbol}</span>
                    <span className="text-[#cacaca]">→</span>
                    <span className="text-white">{protocolName}</span>
                    <span className="text-[#cacaca]">→</span>
                    <span className="text-[#00a888]">{vault?.name ?? asset.token.symbol}</span>
                  </div>
                </div>
              </div>

              {(txError || (modalState === "error" && quoteError)) && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{txError ?? quoteError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {modalState !== "success" && (
          <div className="px-6 pb-6">
            {!authenticated ? (
              <button
                onClick={login}
                className="cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-3.5 text-black text-[15px] font-medium text-center transition-colors active:scale-[0.99]"
              >
                Connect Wallet to Fix This
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={modalState === "loading" || isApproving || isWaitingForApproval || !quote}
                className="font-bold cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-3.5 text-black text-[15px] text-center transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Confirming in wallet...</>
                ) : isWaitingForApproval ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Waiting for network...</>
                ) : (
                  <>Approve {asset.token.symbol}</>
                )}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={modalState === "loading" || modalState === "submitting" || !quote}
                className="cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-3.5 text-black text-[15px] font-bold text-center transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {modalState === "submitting" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Confirming in wallet...</>
                ) : modalState === "loading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Getting best quote...</>
                ) : (
                  `Deposit`
                )}
              </button>
            )}
            <p className="text-center text-[11px] text-[#cacaca] mt-2">Withdrawable anytime. No lockups.</p>
          </div>
        )}
      </div>
    </div>
  );
}
