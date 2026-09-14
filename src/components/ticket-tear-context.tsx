import { createContext, type ReactNode, useContext, useMemo } from 'react';

type TicketTearContextValue = {
  enabled: boolean;
  onTorn: () => void;
};

const TicketTearContext = createContext<TicketTearContextValue>({
  enabled: false,
  onTorn: () => {},
});

export function TicketTearProvider({
  enabled,
  onTorn,
  children,
}: TicketTearContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ enabled, onTorn }), [enabled, onTorn]);

  return (
    <TicketTearContext.Provider value={value}>
      {children}
    </TicketTearContext.Provider>
  );
}

export function useTicketTear() {
  return useContext(TicketTearContext);
}
