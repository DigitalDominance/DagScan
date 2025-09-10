"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type NetworkContextType = {
  currentNetwork: "kasplex" | "igra";
  handleNetworkChange: (network: "kasplex" | "igra") => void;
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [currentNetwork, setCurrentNetwork] = useState<"kasplex" | "igra">("kasplex");

  const handleNetworkChange = (network: "kasplex" | "igra") => {
    setCurrentNetwork(network);
  };

  return (
    <NetworkContext.Provider value={{ currentNetwork, handleNetworkChange }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};