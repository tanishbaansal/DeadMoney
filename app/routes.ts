import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("scan/:address", "routes/scan.tsx"),
  route("deposits", "routes/deposits.tsx"),
] satisfies RouteConfig;
