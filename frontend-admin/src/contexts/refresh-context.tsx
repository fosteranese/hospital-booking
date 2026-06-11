import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface RefreshContextValue {
  isRefreshing: boolean;
  registerRefresh: () => void;
  unregisterRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  isRefreshing: false,
  registerRefresh: () => {},
  unregisterRefresh: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const counterRef = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const registerRefresh = useCallback(() => {
    counterRef.current++;
    if (counterRef.current === 1) {
      setIsRefreshing(true);
    }
  }, []);

  const unregisterRefresh = useCallback(() => {
    counterRef.current = Math.max(0, counterRef.current - 1);
    if (counterRef.current === 0) {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ isRefreshing, registerRefresh, unregisterRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
