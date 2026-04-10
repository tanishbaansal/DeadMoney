import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
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
