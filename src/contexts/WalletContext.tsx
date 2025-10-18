import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletContextType, WalletAccount } from '../types/wallet';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  // Initialize state from localStorage immediately
  const [account, setAccount] = useState<WalletAccount | null>(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    return savedAddress ? { address: savedAddress } : null;
  });
  const [isConnected, setIsConnected] = useState(() => {
    return localStorage.getItem('walletConnected') === 'true';
  });
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
      } else {
        // MetaMask is not connected, but check localStorage for previous connection
        const wasConnected = localStorage.getItem('walletConnected') === 'true';
        const savedAddress = localStorage.getItem('walletAddress');
        
        if (wasConnected && savedAddress) {
          // Restore state from localStorage even if MetaMask is not currently connected
          setAccount({ address: savedAddress });
          setIsConnected(true);
        }
      }
    } catch (err) {
      console.error('Error checking wallet connection:', err);
      // If MetaMask request fails, still try to restore from localStorage
      const wasConnected = localStorage.getItem('walletConnected') === 'true';
      const savedAddress = localStorage.getItem('walletAddress');
      
      if (wasConnected && savedAddress) {
        setAccount({ address: savedAddress });
        setIsConnected(true);
      }
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

  // Verify connection with MetaMask on mount (if already connected from localStorage)
  useEffect(() => {
    const verifyConnection = async () => {
      // Only verify if we're already connected from localStorage
      if (isConnected && account && window.ethereum) {
        try {
          // Check if MetaMask is ready and still connected
          await window.ethereum.request({ method: 'eth_accounts' });
          await checkWalletConnection();
        } catch (err) {
          console.log('MetaMask verification failed, keeping localStorage state:', err);
          // Keep the localStorage state even if MetaMask verification fails
        }
      }
    };

    // Add a small delay to ensure MetaMask is fully loaded
    const timer = setTimeout(verifyConnection, 1000);
    return () => clearTimeout(timer);
  }, [isConnected, account]);

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
