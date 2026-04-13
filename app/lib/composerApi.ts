const COMPOSER_PATH = (path: string) =>
  typeof window !== "undefined" && import.meta.env.DEV
    ? `/composer-api${path}`
    : `https://li.quest${path}`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComposerQuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string; // vault address IS the toToken
  fromAddress: string;
  toAddress: string;
  fromAmount: string; // in smallest unit (e.g. USDC × 1e6)
  slippage?: number;
  maxPriceImpact?: number;
}

export interface TransactionRequest {
  to: string;
  from: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  chainId: number;
}

export interface ComposerQuote {
  id: string;
  type: string;
  tool: string;
  toolDetails: {
    key: string;
    name: string;
    logoURI: string;
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { address: string; symbol: string; decimals: number };
    toToken: { address: string; symbol: string; decimals: number };
    fromAmount: string;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    gasCosts: Array<{ amountUSD: string; amount: string }>;
    executionDuration: number;
    approvalAddress?: string;
  };
  transactionRequest: TransactionRequest;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function getComposerQuote(params: ComposerQuoteParams): Promise<ComposerQuote> {
  const apiKey = import.meta.env.VITE_COMPOSER_API_KEY as string ?? "";

  const searchParams = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    fromAmount: params.fromAmount,
  });

  if (params.slippage) searchParams.set("slippage", String(params.slippage));
  if (params.maxPriceImpact) searchParams.set("maxPriceImpact", String(params.maxPriceImpact));

  const res = await fetch(COMPOSER_PATH(`/v1/quote?${searchParams}`), {
    method: "GET",
    headers: {
      "x-lifi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Composer quote failed: ${res.status} ${err}`);
  }

  return res.json();
}

export function getGasEstimateUsd(quote: ComposerQuote): string {
  const total = quote.estimate.gasCosts?.reduce(
    (sum, g) => sum + (parseFloat(g.amountUSD) || 0),
    0,
  ) ?? 0;
  if (total <= 0) return "~$2.00";
  return `~$${total.toFixed(2)}`;
}

export function getQuoteGasLimit(quote: ComposerQuote): bigint | null {
  const fromTx = quote.transactionRequest?.gasLimit;
  if (!fromTx) return null;
  try {
    return BigInt(fromTx);
  } catch {
    return null;
  }
}
