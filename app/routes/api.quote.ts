import type { Route } from "./+types/api.quote";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.COMPOSER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server missing API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = await request.json();
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

  const res = await fetch(`https://li.quest/v1/quote?${searchParams}`, {
    method: "GET",
    headers: {
      "x-lifi-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(err, { status: res.status });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
