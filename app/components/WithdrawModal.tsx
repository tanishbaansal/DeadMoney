import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { createWalletClient, custom, parseUnits, erc20Abi } from "viem";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";
import type { Position } from "~/lib/earnApi";
import { formatUsd } from "~/lib/deadMoney";
import { useComposerQuote } from "~/hooks/useComposerQuote";
import { getComposerQuote, getGasEstimateUsd, getQuoteGasLimit } from "~/lib/composerApi";
import { getPublicClient } from "~/lib/viem";
import { cn } from "~/lib/utils";
import { CHAIN_NAMES } from "~/lib/tokens";


type ModalState = "loading" | "ready" | "submitting" | "success" | "error";

interface WithdrawModalProps {
  position: Position;
  onClose: () => void;
  onWithdrawn: () => void;
}

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

const NATIVE_ADDR = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// Conservative per-chain fallback gas limits for complex LI.FI composer calls.
const FALLBACK_GAS_BY_CHAIN: Record<number, bigint> = {
  1: 1_200_000n,
  10: 2_000_000n,
  137: 2_500_000n,
  8453: 2_000_000n,
  42161: 5_000_000n,
};

function getFallbackGas(chainId: number): bigint {
  return FALLBACK_GAS_BY_CHAIN[chainId] ?? 2_500_000n;
}

function formatTxError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction cancelled.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient funds for gas. Top up native token and retry.";
  }
  if (lower.includes("chain") && lower.includes("match")) {
    return "Wallet is on the wrong network. Switch to the target chain and retry.";
  }
  if (lower.includes("reverted")) {
    return "Execution reverted. Allowance or balance may be slightly off — try withdrawing a touch less.";
  }
  return msg.slice(0, 140);
}

export function WithdrawModal({ position, onClose, onWithdrawn }: WithdrawModalProps) {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  const autoWithdrawHashRef = useRef<`0x${string}` | null>(null);
  const [modalState, setModalState] = useState<ModalState>(authenticated ? "loading" : "ready");
  const [txError, setTxError] = useState<string | null>(null);

  const { isLoading: isWaitingForApproval } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: position.chainId,
  });

  const userAddress = wallets?.[0]?.address ?? null;
  const vault = position.vault;
  const isNative = vault.address.toLowerCase() === NATIVE_ADDR;

  // Read the live on-chain aToken balance. aTokens rebase every block, so the
  // cached `position.stakedTokenAmount` from the backend is always slightly
  // stale — using it directly causes Aave withdraw() to revert when the amount
  // exceeds the liquidity-index-adjusted balance at submit time.
  const { data: onchainBalance } = useReadContract({
    address: vault.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    chainId: position.chainId,
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress && !isNative, refetchInterval: 15_000 },
  });

  const amountNeeded = useMemo(() => {
    const cached = parseUnits(position.stakedTokenAmount, vault.decimals || 18);
    const live = (onchainBalance as bigint | undefined) ?? cached;
    const base = live < cached ? live : cached;
    // Tiny fixed buffer — just enough to absorb 1-2 blocks of liquidity-index
    // drift on rebasing aTokens between quote and execution. Keeps the user
    // withdrawing ~100% of their position instead of leaving yield behind.
    const dustBuffer = 100n;
    return base > dustBuffer ? base - dustBuffer : 0n;
  }, [position.stakedTokenAmount, vault.decimals, onchainBalance]);

  // Approve with a finite headroom (not infinite): required amount + 1 token buffer.
  // This absorbs tiny rebase drift between quote and execution without perpetual allowance.
  const approvalBuffer = useMemo(() => {
    if (isNative) return 0n;
    const decimals = BigInt(vault.decimals || 18);
    return 10n ** decimals;
  }, [isNative, vault.decimals]);

  const requiredApprovalAmount = useMemo(
    () => amountNeeded + approvalBuffer,
    [amountNeeded, approvalBuffer],
  );

  const quoteParams = useMemo(
    () =>
      authenticated && userAddress && amountNeeded > 0n
        ? {
            fromChain: position.chainId,
            toChain: position.chainId,
            fromToken: vault.address,
            toToken: vault.asset,
            fromAddress: userAddress,
            toAddress: userAddress,
            fromAmount: amountNeeded.toString(),
            slippage: 0.03,
          }
        : null,
    [authenticated, userAddress, vault.address, vault.asset, position.chainId, amountNeeded],
  );

  const { quote, status: quoteStatus, error: quoteError } = useComposerQuote(quoteParams);
  const spender = quote?.estimate?.approvalAddress;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: vault.address as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    chainId: position.chainId,
    args: userAddress && spender ? [userAddress as `0x${string}`, spender as `0x${string}`] : undefined,
    query: { enabled: !!userAddress && !!spender && !isNative },
  });

  const needsApproval = useMemo(() => {
    if (isNative) return false;
    if (allowance == null) return true;
    // Require allowance to cover withdraw amount + safety buffer.
    return (allowance as bigint) < requiredApprovalAmount;
  }, [isNative, allowance, requiredApprovalAmount]);

  useEffect(() => {
    if (approveHash && !isWaitingForApproval) {
      refetchAllowance();
    }
  }, [approveHash, isWaitingForApproval, refetchAllowance]);

  useEffect(() => {
    if (!authenticated) return;
    if (quoteStatus === "loading") setModalState("loading");
    else if (quoteStatus === "done" || quoteStatus === "error") setModalState("ready");
  }, [quoteStatus, authenticated]);

  const getWalletClientForChain = useCallback(
    async (chainId: number) => {
      const wallet = wallets[0];
      if (!wallet) throw new Error("No wallet connected");
      const chain = CHAIN_MAP[chainId];
      if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

      await wallet.switchChain(chainId);

      const provider = await wallet.getEthereumProvider();

      // Poll the provider until it actually reports the target chain. Privy +
      // Phantom sometimes return before the injected provider has propagated
      // the switch, causing viem sendTransaction to throw ChainMismatchError.
      const expectedHex = `0x${chainId.toString(16)}`;
      for (let i = 0; i < 20; i++) {
        try {
          const current = (await provider.request({ method: "eth_chainId" })) as string;
          if (current?.toLowerCase() === expectedHex.toLowerCase()) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 150));
      }

      return createWalletClient({
        account: userAddress as `0x${string}`,
        chain,
        transport: custom(provider),
      });
    },
    [wallets, userAddress],
  );

  const handleApprove = useCallback(async () => {
    if (!spender) return;
    setIsApproving(true);
    setTxError(null);
    try {
      const client = await getWalletClientForChain(position.chainId);
      const hash = await client.writeContract({
        chain: CHAIN_MAP[position.chainId],
        address: vault.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, requiredApprovalAmount],
      });
      autoWithdrawHashRef.current = null;
      setApproveHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setTxError(formatTxError(msg));
    } finally {
      setIsApproving(false);
    }
  }, [spender, getWalletClientForChain, position.chainId, vault.address, requiredApprovalAmount]);

  const resolveGasLimit = useCallback(
    async (
      chainId: number,
      tx: { to: string; data: string; value?: string },
    ): Promise<bigint> => {
      // Prefer quote's own gasLimit — LI.FI computes it with full routing context.
      const quoteGas = quote ? getQuoteGasLimit(quote) : null;

      // Only attempt local estimation when allowance is sufficient — otherwise the
      // simulated call reverts at the transferFrom step, producing the noisy
      // "Execution reverted for an unknown reason" warning.
      const allowanceReady = isNative || ((allowance as bigint | undefined) ?? 0n) >= amountNeeded;
      if (allowanceReady) {
        try {
          const publicClient = getPublicClient(chainId as any);
          const est = await publicClient.estimateGas({
            account: userAddress as `0x${string}`,
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: BigInt(tx.value ?? "0"),
          });
          return (est * 130n) / 100n; // 30% headroom
        } catch {
          // fall through to quote/fallback silently
        }
      }

      if (quoteGas) return (quoteGas * 130n) / 100n;
      return getFallbackGas(chainId);
    },
    [quote, isNative, allowance, amountNeeded, userAddress],
  );

  const handleWithdraw = useCallback(async () => {
    if (!userAddress) return;
    setModalState("submitting");
    setTxError(null);
    try {
      const chainId = position.chainId;
      const publicClient = getPublicClient(chainId as any);

      const liveBal = (await publicClient.readContract({
        address: vault.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [userAddress as `0x${string}`],
      })) as bigint;

      if (liveBal === 0n) {
        throw new Error("Live balance is zero — nothing to withdraw.");
      }

      // Use an adaptive withdraw buffer to avoid edge-case underflow in route math
      // when balances rebase or route internals subtract fees/rounding deltas.
      const oneToken = 10n ** BigInt(vault.decimals || 18);
      const minBuffer = oneToken / 200n; // 0.005 token
      const pctBuffer = liveBal / 400n; // 0.25%
      const dustBuffer = minBuffer > pctBuffer ? minBuffer : pctBuffer;
      const safeAmount = liveBal > dustBuffer ? liveBal - dustBuffer : 0n;

      if (safeAmount === 0n) {
        throw new Error("Live balance is zero — nothing to withdraw.");
      }

      // Try progressively smaller withdraw amounts to avoid edge-case route math underflow.
      const amountCandidates = Array.from(
        new Set(
          [
            safeAmount,
            (safeAmount * 995n) / 1000n, // -0.5%
            (safeAmount * 99n) / 100n, // -1%
            (safeAmount * 98n) / 100n, // -2%
            (safeAmount * 95n) / 100n, // -5%
            (safeAmount * 90n) / 100n, // -10%
          ]
            .filter((v) => v > 0n)
            .map((v) => v.toString()),
        ),
      ).map((v) => BigInt(v));

      let tx: { to: string; data: string; value?: string; gasLimit?: string } | null = null;
      let simulationError: string | null = null;

      for (const candidateAmount of amountCandidates) {
        try {
          const fresh = await getComposerQuote({
            fromChain: chainId,
            toChain: chainId,
            fromToken: vault.address,
            toToken: vault.asset,
            fromAddress: userAddress,
            toAddress: userAddress,
            fromAmount: candidateAmount.toString(),
            slippage: 0.03,
          });
          const nextTx = fresh.transactionRequest;
          const freshSpender = fresh.estimate.approvalAddress as `0x${string}` | undefined;

          // Verify allowance for this exact candidate route/spender.
          if (!isNative && freshSpender) {
            const liveAllowance = (await publicClient.readContract({
              address: vault.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "allowance",
              args: [userAddress as `0x${string}`, freshSpender],
            })) as bigint;


            const inlineApprovalAmount = candidateAmount + approvalBuffer;
            if (liveAllowance < inlineApprovalAmount) {
              const approveClient = await getWalletClientForChain(chainId);
              const approveTxHash = await approveClient.writeContract({
                chain: CHAIN_MAP[chainId],
                address: vault.address as `0x${string}`,
                abi: erc20Abi,
                functionName: "approve",
                args: [freshSpender, inlineApprovalAmount],
              });
              await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
            }
          }

          // Simulate this candidate before asking wallet to sign.
          await publicClient.call({
            account: userAddress as `0x${string}`,
            to: nextTx.to as `0x${string}`,
            data: nextTx.data as `0x${string}`,
            value: BigInt(nextTx.value ?? "0"),
          });
          tx = nextTx;
          simulationError = null;
          break;
        } catch (simErr) {
          const msg = simErr instanceof Error ? simErr.message : String(simErr);
          simulationError = msg;
        }
      }

      if (!tx) {
        throw new Error(
          `Simulation reverted for all withdraw candidates. Last error: ${(simulationError ?? "unknown").slice(0, 220)}`,
        );
      }

      const walletClient = await getWalletClientForChain(chainId);
      const gas = await resolveGasLimit(chainId, tx);

      const hash = await walletClient.sendTransaction({
        chain: CHAIN_MAP[chainId],
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
        gas,
      });

      setModalState("success");
      confetti({
        particleCount: 60,
        spread: 80,
        colors: ["#7C3AED", "#00D4AA", "#F0F0F5"],
        origin: { x: 0.5, y: 0.5 },
      });
      setTimeout(onWithdrawn, 5000);
    } catch (err) {
      console.error("[WithdrawModal] withdraw failed", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(formatTxError(msg));
      setModalState("error");
    }
  }, [
    quote,
    userAddress,
    position.chainId,
    vault.address,
    vault.asset,
    spender,
    isNative,
    amountNeeded,
    approvalBuffer,
    getWalletClientForChain,
    resolveGasLimit,
    onWithdrawn,
  ]);

  // One-click flow: once approval confirms and allowance updates, auto-start withdraw.
  useEffect(() => {
    if (!approveHash || isWaitingForApproval) return;
    if (!quote || needsApproval) return;
    if (modalState !== "ready" && modalState !== "error") return;
    if (autoWithdrawHashRef.current === approveHash) return;

    autoWithdrawHashRef.current = approveHash;
    void handleWithdraw();
  }, [approveHash, isWaitingForApproval, quote, needsApproval, modalState, handleWithdraw]);

  const gasEstimate = quote ? getGasEstimateUsd(quote) : "~$2.00";
  const chainName = CHAIN_NAMES[position.chainId as keyof typeof CHAIN_NAMES] ?? String(position.chainId);

  const displayAmount = (() => {
    const decimals = vault.decimals || 18;
    const live = onchainBalance as bigint | undefined;
    const cached = parseFloat(position.stakedTokenAmount);
    if (live && live > 0n) {
      const divisor = 10 ** decimals;
      return (Number(live) / divisor).toFixed(4);
    }
    return cached.toFixed(4);
  })();

  const shortAddr = userAddress
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : `${vault.asset.slice(0, 6)}...${vault.asset.slice(-4)}`;

  const protocolName =
    typeof (vault as any).protocol === "string"
      ? (vault as any).protocol
      : (vault as any).protocol?.name ?? "Aave";
  const headerLogo =
    (position as any)?.stakedToken?.logoURI ??
    (position as any)?.stakedToken?.logoUrl ??
    vault.logoUrl ??
    vault.protocolLogoUrl ??
    null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      <div
        className={cn(
          "relative z-10 w-full sm:max-w-[520px]",
          "rounded-t-[20px] sm:rounded-[20px] overflow-hidden",
          "shadow-[0px_2px_12px_0px_rgba(73,73,73,0.25)]",
          "backdrop-blur-[37.65px]",
          "bg-[linear-gradient(180deg,rgba(14,11,20,0.92)_0%,rgba(31,9,69,0.78)_45%,rgba(14,11,20,0.92)_100%)]",
        )}
      >
        <div className="flex flex-col gap-5 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#22222e] shrink-0 flex items-center justify-center">
                {headerLogo ? (
                  <img
                    src={headerLogo}
                    alt={vault.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo-icon.svg";
                    }}
                  />
                ) : (
                  <img src="/logo-icon.svg" alt="" className="w-6 h-6 object-contain opacity-90" />
                )}
              </div>
              <div className="flex flex-col gap-1 justify-center min-w-0">
                <h2 className="font-medium text-white text-[20px] leading-none tracking-[0.6px] capitalize truncate">
                  {modalState === "success" ? "Withdrawal Sent" : "Withdrawal Route"}
                </h2>
                <p className="text-[#cacaca] text-[12px] tracking-[0.4px] capitalize truncate">
                  Existing {vault.name}
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
              <p className="text-white text-[16px] font-medium mb-1.5">Withdrawal Initiated</p>
              <p className="text-[#cacaca] text-[12px]">
                Your funds are heading back to your wallet.
              </p>
            </div>
          ) : (
            <div className="rounded-[10px] bg-[rgba(14,11,20,0.67)] backdrop-blur-[37.65px] p-4 flex justify-center">
              <div className="flex flex-col gap-4 items-center justify-center text-center w-full max-w-[460px]">
                <p className="text-white text-[12px] font-medium tracking-[0.48px] uppercase">
                  You are withdrawing
                </p>
                {modalState === "loading" ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : (
                  <p className="text-white text-[40px] sm:text-[48px] font-medium leading-none whitespace-nowrap">
                    {displayAmount}
                  </p>
                )}
                <p className="text-[#cacaca] text-[16px]">
                  {formatUsd(position.stakedTokenAmountUsd)}
                </p>
              </div>
            </div>
          )}

          {modalState !== "success" && (
            <div
              className="rounded-[10px] backdrop-blur-[37.65px] p-4 flex items-center justify-between gap-3"
              style={{
                backgroundImage:
                  "linear-gradient(98.47deg, rgba(14, 11, 20, 0.67) 1%, rgba(31, 9, 69, 0.67) 45%, rgba(14, 11, 20, 0.67) 100%)",
              }}
            >
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <p className="text-[#cacaca] text-[12px] font-medium tracking-[0.4px] uppercase">
                  Withdrawal Route
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[12px] tracking-[0.4px] capitalize">
                  <span className="text-[#00a888] font-mono">{vault.name}</span>
                  <span className="text-[#cacaca]">→</span>
                  <span className="text-white">{protocolName}</span>
                  <span className="text-[#cacaca]">→</span>
                  <span className="text-[#cacaca] font-mono">{shortAddr}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#9898a8] pt-1">
                  <span className="uppercase tracking-wider">Network: {chainName}</span>
                  <span>Gas: {gasEstimate}</span>
                </div>
              </div>
            </div>
          )}

          {(txError || (modalState === "error" && quoteError)) && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{txError ?? quoteError}</span>
            </div>
          )}
        </div>

        {modalState !== "success" && (
          <div className="px-6 pb-6">
            {!authenticated ? (
              <button
                onClick={login}
                className="cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-4 text-black text-[16px] font-medium text-center transition-colors active:scale-[0.99]"
              >
                Connect Wallet
              </button>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={modalState === "loading" || isApproving || isWaitingForApproval || !quote}
                className="cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-4 text-black text-[16px] font-medium text-center transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming in wallet...
                  </>
                ) : isWaitingForApproval ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for network...
                  </>
                ) : (
                  "Continue to Withdrawal"
                )}
              </button>
            ) : (
              <button
                onClick={handleWithdraw}
                disabled={modalState === "loading" || modalState === "submitting" || !quote}
                className="cursor-pointer w-full rounded-[10px] bg-[#c9f352] hover:bg-[#d4ff5e] px-4 py-4 text-black text-[16px] font-medium text-center transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  "Continue to Withdrawal"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
