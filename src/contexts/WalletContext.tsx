import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletContextType, WalletAccount } from '../types/wallet';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkWalletConnection = async () => {
    if (!window.ethereum) {
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setAccount({ address });
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err);
    }
  };

  const connectWallet = async (providerId: string) => {
    if (providerId !== 'metamask') {
      setError('Only MetaMask is supported at this time');
      return;
    }

    const ethereum = window.ethereum as any;
    const provider = ethereum?.providers
      ? ethereum.providers.find((p: any) => p.isMetaMask)
      : ethereum?.isMetaMask
        ? ethereum
        : null;

    if (!provider) {
      setError("MetaMask not found. Please install MetaMask to connect.");
      return;
    }


    setIsLoading(true);
    setError(null);

    try {
      // Check if MetaMask is locked
      const accounts = await provider.request({ method: 'eth_accounts' });

      if (accounts.length === 0) {
        // MetaMask is locked or no accounts, request connection
        const newAccounts = await provider.request({
          method: 'eth_requestAccounts',
        });

        if (newAccounts.length > 0) {
          const address = newAccounts[0];
          setAccount({ address });
          setIsConnected(true);

          // Store connection state in localStorage
          localStorage.setItem('walletConnected', 'true');
          localStorage.setItem('walletAddress', address);
        }
      } else {
        // Already connected
        const address = accounts[0];
        setAccount({ address });
        setIsConnected(true);

        // Store connection state in localStorage
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', address);
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      if (err.code === 4001) {
        setError('User rejected the connection request');
      } else if (err.code === -32002) {
        setError('MetaMask request is already pending. Please check your MetaMask extension.');
      } else if (err.message?.includes('User denied')) {
        setError('Connection was denied. Please try again.');
      } else {
        setError(`Failed to connect wallet: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setError(null);

    // Clear localStorage
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
  };

  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      // Wait for MetaMask to be ready
      if (window.ethereum) {
        try {
          // Check if MetaMask is ready
          await window.ethereum.request({ method: 'eth_accounts' });
        } catch (err) {
          console.log('MetaMask not ready yet:', err);
          return;
        }
      }

      const wasConnected = localStorage.getItem('walletConnected') === 'true';
      const savedAddress = localStorage.getItem('walletAddress');

      if (wasConnected && savedAddress) {
        await checkWalletConnection();
      }
    };

    // Add a small delay to ensure MetaMask is fully loaded
    const timer = setTimeout(checkExistingConnection, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount({ address: accounts[0] });
        setIsConnected(true);
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletAddress', accounts[0]);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const value: WalletContextType = {
    account,
    isConnected,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    checkWalletConnection,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
