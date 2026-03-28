import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface LocalUser {
  id: number;
  name: string;
  username: string;
}

interface LocalAuthContextValue {
  user: LocalUser | null;
  masterPassword: string;
  setMasterPassword: (pw: string) => void;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const LocalAuthContext = createContext<LocalAuthContextValue>({
  user: null,
  masterPassword: "",
  setMasterPassword: () => {},
  loading: true,
  isAuthenticated: false,
  logout: () => {},
});

export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [masterPassword, setMasterPasswordState] = useState<string>(() => {
    // Keep master password in sessionStorage so it persists across page refreshes
    // but is cleared when the browser tab is closed
    return sessionStorage.getItem("edh_mp") ?? "";
  });

  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
      sessionStorage.removeItem("edh_mp");
      setMasterPasswordState("");
      utils.localAuth.me.invalidate();
    },
  });

  const setMasterPassword = (pw: string) => {
    setMasterPasswordState(pw);
    if (pw) {
      sessionStorage.setItem("edh_mp", pw);
    } else {
      sessionStorage.removeItem("edh_mp");
    }
  };

  const logout = () => logoutMutation.mutate();

  return (
    <LocalAuthContext.Provider
      value={{
        user: user ?? null,
        masterPassword,
        setMasterPassword,
        loading: isLoading,
        isAuthenticated: !!user,
        logout,
      }}
    >
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth() {
  return useContext(LocalAuthContext);
}
