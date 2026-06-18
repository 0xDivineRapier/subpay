import React, { createContext, useContext, useMemo } from 'react';
import { SubPayClient } from './client.js';
import { SubPayConfig } from './types.js';

interface SubPayContextValue {
  client: SubPayClient;
  config: SubPayConfig;
}

const SubPayContext = createContext<SubPayContextValue | null>(null);

interface SubPayProviderProps {
  config: SubPayConfig;
  children: React.ReactNode;
}

export function SubPayProvider({ config, children }: SubPayProviderProps) {
  const value = useMemo(
    () => ({ client: new SubPayClient(config), config }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apiKey, config.network, config.rpcEndpoint],
  );

  return <SubPayContext.Provider value={value}>{children}</SubPayContext.Provider>;
}

export function useSubPay(): SubPayContextValue {
  const ctx = useContext(SubPayContext);
  if (!ctx) {
    throw new Error('useSubPay must be used within a SubPayProvider');
  }
  return ctx;
}
