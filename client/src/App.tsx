import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import Vault from "@/pages/Vault";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocalAuthProvider, useLocalAuth } from "./contexts/LocalAuthContext";

function ProtectedVault() {
  const { isAuthenticated, loading } = useLocalAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 gradient-red rounded-xl animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Auth />;
  return <Vault />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={ProtectedVault} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LocalAuthProvider>
          <TooltipProvider>
            <Toaster
              theme="dark"
              toastOptions={{
                style: {
                  background: "oklch(0.1 0.005 0)",
                  border: "1px solid oklch(0.2 0.008 0)",
                  color: "oklch(0.95 0.005 0)",
                },
              }}
            />
            <Router />
          </TooltipProvider>
        </LocalAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
