export interface WalletAccount {
  address: string;
  balance?: string;
}

export interface WalletProvider {
  name: string;
  id: string;
  icon: string;
  isInstalled: boolean;
}

export interface WalletContextType {
  account: WalletAccount | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectWallet: (providerId: string) => Promise<void>;
  disconnectWallet: () => void;
  checkWalletConnection: () => Promise<void>;
}

export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
