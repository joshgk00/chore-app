import { createContext, useContext, useEffect, useState } from "react";

interface OnlineContextValue {
  isOnline: boolean;
}

const OnlineContext = createContext<OnlineContextValue>({ isOnline: true });

export function useOnline(): boolean {
  return useContext(OnlineContext).isOnline;
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return <OnlineContext.Provider value={{ isOnline }}>{children}</OnlineContext.Provider>;
}
