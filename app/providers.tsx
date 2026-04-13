import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, base, arbitrum, optimism, polygon, zkSync } from "wagmi/chains";
import type { ReactNode } from "react";

const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon, zkSync],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [zkSync.id]: http(),
  },
});

const queryClient = new QueryClient();

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          walletList: ["metamask", "coinbase_wallet", "rainbow", "phantom", "backpack"],
          showWalletLoginFirst: true,
        },
        defaultChain: base,
        supportedChains: [mainnet, base, arbitrum, optimism, polygon, zkSync],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
