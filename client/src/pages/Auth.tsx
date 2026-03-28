import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Lock, User, KeyRound } from "lucide-react";

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "", color: "", width: "0%" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Muito fraca", color: "bg-red-600", width: "20%" };
  if (score === 2) return { score, label: "Fraca", color: "bg-orange-500", width: "40%" };
  if (score === 3) return { score, label: "Média", color: "bg-yellow-500", width: "60%" };
  if (score === 4) return { score, label: "Forte", color: "bg-emerald-500", width: "80%" };
  return { score, label: "Muito forte", color: "bg-green-400", width: "100%" };
}

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);

  const { setMasterPassword } = useLocalAuth();
  const utils = trpc.useUtils();

  const strength = getPasswordStrength(password);

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      setMasterPassword(password);
      utils.localAuth.me.invalidate();
      toast.success(`Bem-vindo de volta, ${data.user.name}!`);
    },
    onError: (err) => {
      toast.error(err.message || "Usuário ou senha incorretos.");
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      setMasterPassword(password);
      utils.localAuth.me.invalidate();
      toast.success(`Conta criada! Bem-vindo, ${data.user.name}!`);
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("usuário") && msg.toLowerCase().includes("uso")) {
        setUsernameTaken(true);
        toast.error("Este usuário já existe. Tente outro nome!", { duration: 4000 });
      } else {
        toast.error(msg || "Erro ao criar conta.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameTaken(false);
    if (mode === "login") {
      if (!username || !password) return toast.error("Preencha todos os campos.");
      loginMutation.mutate({ username, password });
    } else {
      if (!name || !username || !password || !confirmPassword)
        return toast.error("Preencha todos os campos.");
      if (password !== confirmPassword)
        return toast.error("As senhas não coincidem.");
      if (password.length < 8)
        return toast.error("A senha deve ter pelo menos 8 caracteres.");
      registerMutation.mutate({ name, username, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663485280303/jZHyXnwUY8zYM24krTBfV3/edh-login-bg_4451c760.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 gradient-red rounded-2xl mb-4 glow-red">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            EDH STORE KEYS
          </h1>
          <p className="text-muted-foreground text-sm mt-1 tracking-wide">
            Cofre de senhas seguro e criptografado
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex bg-secondary rounded-xl p-1 mb-6">
            {(["login", "register"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setMode(tab);
                  setName("");
                  setUsername("");
                  setPassword("");
                  setConfirmPassword("");
                  setUsernameTaken(false);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === tab
                    ? "gradient-red text-primary-foreground glow-red shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pb-0.5">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                      Nome
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 bg-secondary border-border focus:border-primary h-11"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username field */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Ex: EduZino123"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUsernameTaken(false); }}
                  className={`pl-10 bg-secondary border-border focus:border-primary h-11 ${usernameTaken ? "border-orange-500" : ""}`}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              {usernameTaken && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2.5"
                >
                  <p className="text-xs text-orange-400 font-medium">Este usuário já existe.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setName("");
                      setPassword("");
                      setConfirmPassword("");
                      setUsernameTaken(false);
                    }}
                    className="text-xs text-primary font-semibold hover:underline ml-2 flex-shrink-0"
                  >
                    Fazer login →
                  </button>
                </motion.div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                {mode === "register" ? "Senha mestra" : "Senha"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-secondary border-border focus:border-primary h-11"
                  disabled={isLoading}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === "register" && password && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${strength.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: strength.width }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Força:{" "}
                    <span
                      className={
                        strength.score <= 2
                          ? "text-red-400"
                          : strength.score === 3
                          ? "text-yellow-400"
                          : "text-emerald-400"
                      }
                    >
                      {strength.label}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Esta senha também será usada para criptografar suas senhas armazenadas.
                  </p>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pb-0.5">
                    <Label className="text-muted-foreground text-xs uppercase tracking-widest">
                      Confirmar senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`pl-10 pr-10 bg-secondary border-border focus:border-primary h-11 ${
                          confirmPassword && confirmPassword !== password
                            ? "border-destructive"
                            : ""
                        }`}
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-xs text-destructive">As senhas não coincidem.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 gradient-red glow-red text-primary-foreground font-semibold text-base rounded-xl mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === "login" ? "Entrando..." : "Criando conta..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  {mode === "login" ? "Entrar no cofre" : "Criar minha conta"}
                </span>
              )}
            </Button>
          </form>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-2.5 bg-secondary/50 rounded-xl p-3">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Suas senhas são criptografadas com{" "}
              <span className="text-primary font-semibold">AES-256-GCM</span>{" "}
              diretamente no seu navegador. O servidor nunca vê suas senhas em texto puro.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
