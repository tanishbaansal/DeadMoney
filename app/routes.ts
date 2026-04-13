import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("scan/:address", "routes/scan.tsx"),
  route("deposits", "routes/deposits.tsx"),
  route("api/quote", "routes/api.quote.ts"),
  route("api/rpc/:chainId", "routes/api.rpc.$chainId.ts"),
] satisfies RouteConfig;
