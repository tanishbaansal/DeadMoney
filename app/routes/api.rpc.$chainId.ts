import type { Route } from "./+types/api.rpc.$chainId";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyKey) {
    return new Response(JSON.stringify({ error: "Server missing API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const alchemyUrls: Record<string, string> = {
    "1": `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "8453": `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "42161": `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "10": `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    "137": `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };

  const url = alchemyUrls[params.chainId as string];
  
  if (!url) {
    // If it's a chain we don't proxy through alchemy (like zkSync), or unsupported
    return new Response("Unsupported chain ID for RPC proxy", { status: 400 });
  }

  // Forward the exact JSON body from the client to Alchemy
  const body = await request.text();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
