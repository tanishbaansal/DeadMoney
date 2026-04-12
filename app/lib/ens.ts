import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

const alchemyKey = typeof window !== "undefined"
  ? (import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)
  : undefined;
const isDev = typeof window !== "undefined" && import.meta.env.DEV;

const ethRpc = alchemyKey
  ? isDev
    ? `/rpc/eth/v2/${alchemyKey}`
    : `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
  : "https://ethereum.publicnode.com";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(ethRpc),
});

export async function resolveAddress(input: string): Promise<string> {
  const trimmed = input.trim();

  if (trimmed.endsWith(".eth") || trimmed.includes(".")) {
    const resolved = await ethClient.getEnsAddress({ name: trimmed });
    if (!resolved) throw new Error(`Could not resolve ENS name: ${trimmed}`);
    return resolved;
  }

  if (isAddress(trimmed)) return trimmed;

  throw new Error("Invalid address or ENS name");
}

export function isEnsName(input: string): boolean {
  return input.trim().includes(".");
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
