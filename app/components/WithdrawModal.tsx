import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, ArrowLeftRight } from "lucide-react";
import confetti from "canvas-confetti";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { createWalletClient, custom, parseUnits, erc20Abi } from "viem";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import type { Chain } from "viem";
import type { Position } from "~/lib/earnApi";
import { getEarnWithdrawTx } from "~/lib/earnApi";
import { formatUsd } from "~/lib/deadMoney";
import { useComposerQuote } from "~/hooks/useComposerQuote";
import { getComposerQuote, getGasEstimateUsd, getQuoteGasLimit } from "~/lib/composerApi";
import { getPublicClient } from "~/lib/viem";
import { cn } from "~/lib/utils";
import { CHAIN_NAMES } from "~/lib/tokens";

const DEBUG = true;
const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[WithdrawModal]", ...args);
};

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
    return (allowance as bigint) < amountNeeded;
  }, [isNative, allowance, amountNeeded]);

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
        args: [spender as `0x${string}`, amountNeeded],
      });
      setApproveHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setTxError(formatTxError(msg));
    } finally {
      setIsApproving(false);
    }
  }, [spender, getWalletClientForChain, position.chainId, vault.address, amountNeeded]);

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

      // ── Preferred path: LI.FI Earn API withdraw endpoint ───────────────
      // This is the LI.FI-native endpoint built specifically for exiting
      // vault positions. It handles protocol-specific quirks (Aave rebasing,
      // Morpho share math, Yearn v3 pps rounding) that the raw Composer
      // /v1/quote endpoint gets wrong for aTokens.
      const liveBal = (await publicClient.readContract({
        address: vault.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [userAddress as `0x${string}`],
      })) as bigint;

      log("preflight", {
        chainId,
        userAddress,
        vault: vault.address,
        underlying: vault.asset,
        liveBalance: liveBal.toString(),
      });

      if (liveBal === 0n) {
        throw new Error("Live balance is zero — nothing to withdraw.");
      }

      try {
        log("requesting Earn withdraw tx...");
        const earnRes = await getEarnWithdrawTx({
          vaultAddress: vault.address,
          chainId,
          userAddress,
          amount: liveBal.toString(),
          asset: vault.asset,
        });
        log("earn withdraw response", earnRes);

        const earnTx =
          earnRes.transactionRequest ??
          (Array.isArray(earnRes.transactionRequests)
            ? earnRes.transactionRequests[earnRes.transactionRequests.length - 1]
            : undefined);

        if (earnTx?.to && earnTx.data) {
          // Simulate before prompting the wallet.
          try {
            await publicClient.call({
              account: userAddress as `0x${string}`,
              to: earnTx.to as `0x${string}`,
              data: earnTx.data as `0x${string}`,
              value: BigInt(earnTx.value ?? "0"),
            });
            log("earn simulation OK");
          } catch (simErr) {
            log("earn simulation reverted, falling back to composer", simErr);
            throw new Error("earn-sim-failed");
          }

          const walletClient = await getWalletClientForChain(chainId);
          let gas: bigint;
          try {
            const est = await publicClient.estimateGas({
              account: userAddress as `0x${string}`,
              to: earnTx.to as `0x${string}`,
              data: earnTx.data as `0x${string}`,
              value: BigInt(earnTx.value ?? "0"),
            });
            gas = (est * 130n) / 100n;
          } catch {
            gas = earnTx.gasLimit ? (BigInt(earnTx.gasLimit) * 130n) / 100n : getFallbackGas(chainId);
          }

          log("sending earn tx", { to: earnTx.to, gas: gas.toString() });
          const hash = await walletClient.sendTransaction({
            chain: CHAIN_MAP[chainId],
            to: earnTx.to as `0x${string}`,
            data: earnTx.data as `0x${string}`,
            value: BigInt(earnTx.value ?? "0"),
            gas,
          });
          log("earn tx sent", hash);

          setModalState("success");
          confetti({
            particleCount: 60,
            spread: 80,
            colors: ["#7C3AED", "#00D4AA", "#F0F0F5"],
            origin: { x: 0.5, y: 0.5 },
          });
          setTimeout(onWithdrawn, 2500);
          return;
        }
        log("earn response missing transactionRequest, falling back to composer");
      } catch (earnErr) {
        log("earn withdraw path failed, falling back to composer", earnErr);
      }

      // ── Fallback path: LI.FI Composer /v1/quote ────────────────────────
      if (!quote) {
        throw new Error("Earn withdraw unavailable and no Composer quote ready. Please retry.");
      }

      // Refetch live allowance before rebuilding the Composer quote.
      const liveAllowance = spender
        ? ((await publicClient.readContract({
            address: vault.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "allowance",
            args: [userAddress as `0x${string}`, spender as `0x${string}`],
          })) as bigint)
        : 0n;

      // Withdraw essentially the full balance. Only back off by a tiny fixed
      // amount (covers 1-2 blocks of Aave liquidity-index drift between the
      // quote build and execution) so the user gets ~100% of their position.
      const dustBuffer = 100n;
      const safeAmount = liveBal > dustBuffer ? liveBal - dustBuffer : 0n;

      log("composer fallback preflight", {
        liveAllowance: liveAllowance.toString(),
        safeAmount: safeAmount.toString(),
      });

      if (safeAmount === 0n) {
        throw new Error("Live balance is zero — nothing to withdraw.");
      }
      if (!isNative && liveAllowance < safeAmount) {
        throw new Error(
          `Allowance (${liveAllowance}) is below required (${safeAmount}). Re-approve and retry.`,
        );
      }

      // Always re-quote with the live safe amount. The previous quote may have
      // been built against a slightly different aToken balance.
      log("re-quoting with live amount...");
      const fresh = await getComposerQuote({
        fromChain: chainId,
        toChain: chainId,
        fromToken: vault.address,
        toToken: vault.asset,
        fromAddress: userAddress,
        toAddress: userAddress,
        fromAmount: safeAmount.toString(),
        slippage: 0.03,
      });
      const tx = fresh.transactionRequest;
      log("fresh quote", {
        tool: fresh.tool,
        to: tx.to,
        value: tx.value,
        gasLimit: tx.gasLimit,
        fromAmount: fresh.action.fromAmount,
        toAmountMin: fresh.estimate.toAmountMin,
        approvalAddress: fresh.estimate.approvalAddress,
        dataLen: tx.data?.length,
      });

      // Simulate the full composer call — surfaces revert reasons before
      // prompting the wallet so users never see a Phantom "will revert" flag.
      try {
        await publicClient.call({
          account: userAddress as `0x${string}`,
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value ?? "0"),
        });
        log("composer simulation OK");
      } catch (simErr) {
        log("composer simulation reverted", simErr);
        const msg = simErr instanceof Error ? simErr.message : String(simErr);
        throw new Error(`Simulation reverted: ${msg.slice(0, 200)}`);
      }

      const walletClient = await getWalletClientForChain(chainId);
      const gas = await resolveGasLimit(chainId, tx);
      log("sending tx", { gas: gas.toString() });

      const hash = await walletClient.sendTransaction({
        chain: CHAIN_MAP[chainId],
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
        gas,
      });
      log("tx sent", hash);

      setModalState("success");
      confetti({
        particleCount: 60,
        spread: 80,
        colors: ["#7C3AED", "#00D4AA", "#F0F0F5"],
        origin: { x: 0.5, y: 0.5 },
      });
      setTimeout(onWithdrawn, 2500);
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
    getWalletClientForChain,
    resolveGasLimit,
    onWithdrawn,
  ]);

  const gasEstimate = quote ? getGasEstimateUsd(quote) : "~$2.00";
  const chainName = CHAIN_NAMES[position.chainId as keyof typeof CHAIN_NAMES] ?? String(position.chainId);

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
          "relative z-10 w-full bg-[#1a1a24] border border-[#2a2a3a]",
          "sm:max-w-lg sm:rounded-3xl rounded-t-3xl",
          "shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden",
        )}
      >
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
          <button
            onClick={onClose}
            className="cursor-pointer w-8 h-8 rounded-full bg-[#22222e] hover:bg-[#2a2a3a] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[#9898a8]" />
          </button>
        </div>

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
              <div className="rounded-2xl bg-[#22222e] border border-[#2a2a3a] p-4 text-center">
                <p className="text-xs text-[#5a5a6a] uppercase tracking-wider mb-2">You are withdrawing</p>
                <p className="font-mono text-3xl font-bold text-[#f0f0f5]">
                  {(() => {
                    const decimals = vault.decimals || 18;
                    const live = onchainBalance as bigint | undefined;
                    const cached = parseFloat(position.stakedTokenAmount);
                    if (live && live > 0n) {
                      const divisor = 10 ** decimals;
                      return (Number(live) / divisor).toFixed(4);
                    }
                    return cached.toFixed(4);
                  })()}
                </p>
                <p className="text-sm text-[#9898a8] mt-1">{formatUsd(position.stakedTokenAmountUsd)}</p>
              </div>

              <div className="flex items-center justify-between text-xs text-[#5a5a6a] px-1">
                <span>Network: {chainName}</span>
                <span>Gas estimate: {gasEstimate}</span>
              </div>

              <div className="rounded-xl bg-purple-950/20 border border-purple-500/20 p-3">
                <p className="text-xs text-purple-300 font-bold mb-1.5">Withdrawal Route</p>
                <div className="flex items-center gap-2 text-xs text-[#9898a8]">
                  <span className="text-[#00d4aa] font-mono font-bold">{vault.name}</span>
                  <span>→</span>
                  <span className="text-[#f0f0f5]">LI.FI Composer</span>
                  <span>→</span>
                  <span className="font-mono">
                    {vault.asset.slice(0, 6)}...{vault.asset.slice(-4)}
                  </span>
                </div>
              </div>

              {(txError || (modalState === "error" && quoteError)) && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{txError ?? quoteError}</span>
                </div>
              )}
            </>
          )}
        </div>

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
