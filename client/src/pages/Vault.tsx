import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { encryptPassword, decryptPassword } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Search,
  Pencil,
  Trash2,
  KeyRound,
  Shield,
  LogOut,
  User,
  Lock,
  FolderPlus,
  Folder,
  FolderOpen,
  MoreHorizontal,
  ChevronRight,
  Layers,
  Calendar,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Subscription helpers ─────────────────────────────────────────────────────

function getDaysRemaining(subscriptionStart: string | Date | null | undefined, subscriptionDays: number | null | undefined) {
  if (!subscriptionStart || !subscriptionDays) return null;
  const start = new Date(subscriptionStart);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + subscriptionDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getSubscriptionStatus(daysRemaining: number | null) {
  if (daysRemaining === null) return null;
  if (daysRemaining < 0) return { label: "Expirado", color: "text-gray-400", bg: "bg-gray-500/20", border: "border-gray-500/30", bar: "bg-gray-500", urgent: false };
  if (daysRemaining === 0) return { label: "Expira hoje!", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/40", bar: "bg-red-500", urgent: true };
  if (daysRemaining <= 3) return { label: `${daysRemaining}d restantes`, color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/40", bar: "bg-red-500", urgent: true };
  if (daysRemaining <= 7) return { label: `${daysRemaining}d restantes`, color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30", bar: "bg-orange-500", urgent: true };
  if (daysRemaining <= 14) return { label: `${daysRemaining}d restantes`, color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30", bar: "bg-yellow-500", urgent: false };
  return { label: `${daysRemaining}d restantes`, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", bar: "bg-emerald-500", urgent: false };
}

// ─── Password Strength ────────────────────────────────────────────────────────

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

// ─── Service Icon ─────────────────────────────────────────────────────────────

function ServiceIcon({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const colors = ["from-red-700 to-red-900", "from-rose-600 to-red-800", "from-red-600 to-rose-900", "from-red-800 to-red-950", "from-rose-700 to-red-900", "from-red-500 to-red-800"];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 border border-primary/20`}>
      {initials || <KeyRound className="w-4 h-4" />}
    </div>
  );
}

// ─── Credential Form ──────────────────────────────────────────────────────────

interface CredentialFormData {
  serviceName: string;
  username: string;
  plainPassword: string;
  notes: string;
  groupId: number | null;
  subscriptionStart: string;
  subscriptionDays: string;
}

interface CredentialFormProps {
  open: boolean;
  onClose: () => void;
  initial?: CredentialFormData & { id?: number };
  onSave: (data: CredentialFormData) => void;
  loading: boolean;
  title: string;
  groups: { id: number; name: string }[];
  defaultGroupId?: number | null;
}

function CredentialForm({ open, onClose, initial, onSave, loading, title, groups, defaultGroupId }: CredentialFormProps) {
  const [form, setForm] = useState<CredentialFormData>(
    initial ?? { serviceName: "", username: "", plainPassword: "", notes: "", groupId: defaultGroupId ?? null, subscriptionStart: "", subscriptionDays: "" }
  );
  const [showPass, setShowPass] = useState(false);
  const strength = useMemo(() => getPasswordStrength(form.plainPassword), [form.plainPassword]);

  if (!open) return null;

  // Preview days remaining
  const previewDays = form.subscriptionStart && form.subscriptionDays
    ? getDaysRemaining(form.subscriptionStart, parseInt(form.subscriptionDays) || null)
    : null;
  const previewStatus = getSubscriptionStatus(previewDays);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-widest">Serviço</Label>
            <Input placeholder="Ex: Gmail, Netflix, GitHub..." value={form.serviceName} onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))} className="bg-secondary border-border focus:border-primary" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-widest">Email / Usuário</Label>
            <Input placeholder="seu@email.com" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="bg-secondary border-border focus:border-primary" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-widest">Senha</Label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} placeholder="••••••••••••" value={form.plainPassword} onChange={(e) => setForm((f) => ({ ...f, plainPassword: e.target.value }))} className="bg-secondary border-border focus:border-primary pr-10" />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.plainPassword && (
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${strength.color}`} initial={{ width: 0 }} animate={{ width: strength.width }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>
                <p className="text-xs text-muted-foreground">Força: <span className={strength.score <= 2 ? "text-red-400" : strength.score === 3 ? "text-yellow-400" : "text-emerald-400"}>{strength.label}</span></p>
              </div>
            )}
          </div>

          {/* Subscription section */}
          <div className="border border-border/60 rounded-xl p-3 space-y-3 bg-secondary/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Validade da assinatura (opcional)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Data de início</Label>
                <Input
                  type="date"
                  value={form.subscriptionStart}
                  onChange={(e) => setForm((f) => ({ ...f, subscriptionStart: e.target.value }))}
                  className="bg-secondary border-border focus:border-primary text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Duração (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Ex: 30"
                  value={form.subscriptionDays}
                  onChange={(e) => setForm((f) => ({ ...f, subscriptionDays: e.target.value }))}
                  className="bg-secondary border-border focus:border-primary text-sm"
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subscriptionDays: String(d) }))}
                  className={`px-2 py-0.5 rounded-md text-xs border transition-all ${form.subscriptionDays === String(d) ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                >
                  {d === 365 ? "1 ano" : d === 180 ? "6 meses" : d === 90 ? "3 meses" : d === 60 ? "2 meses" : d === 30 ? "1 mês" : `${d}d`}
                </button>
              ))}
            </div>

            {/* Preview */}
            {previewStatus && previewDays !== null && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${previewStatus.bg} ${previewStatus.border}`}>
                <Clock className={`w-3.5 h-3.5 ${previewStatus.color}`} />
                <span className={`text-xs font-medium ${previewStatus.color}`}>
                  {previewDays < 0 ? "Já expirou" : previewDays === 0 ? "Expira hoje!" : `Expira em ${previewDays} dia${previewDays !== 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </div>

          {/* Group selector */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-widest">Grupo (opcional)</Label>
              <select value={form.groupId ?? ""} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value ? Number(e.target.value) : null }))} className="w-full h-10 rounded-lg bg-secondary border border-border text-foreground text-sm px-3 focus:outline-none focus:border-primary">
                <option value="">Sem grupo</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-widest">Notas (opcional)</Label>
            <Input placeholder="Informações adicionais..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="bg-secondary border-border focus:border-primary" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={loading || !form.serviceName || !form.username || !form.plainPassword} className="gradient-red text-primary-foreground font-semibold glow-red">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subscription Badge ───────────────────────────────────────────────────────

function SubscriptionBadge({ subscriptionStart, subscriptionDays }: { subscriptionStart?: string | Date | null; subscriptionDays?: number | null }) {
  const days = getDaysRemaining(subscriptionStart, subscriptionDays);
  const status = getSubscriptionStatus(days);
  if (!status || days === null) return null;

  const totalDays = subscriptionDays ?? 1;
  const elapsed = totalDays - Math.max(days, 0);
  const progressPct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 ${status.bg} ${status.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {status.urgent ? <AlertTriangle className={`w-3 h-3 ${status.color}`} /> : <Clock className={`w-3 h-3 ${status.color}`} />}
          <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
        </div>
        {subscriptionDays && (
          <span className="text-xs text-muted-foreground">{subscriptionDays}d total</span>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${status.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {subscriptionStart && (
        <p className="text-xs text-muted-foreground mt-1">
          Início: {new Date(subscriptionStart).toLocaleDateString("pt-BR")}
          {subscriptionDays && (() => {
            const exp = new Date(subscriptionStart);
            exp.setDate(exp.getDate() + subscriptionDays);
            return ` · Vence: ${exp.toLocaleDateString("pt-BR")}`;
          })()}
        </p>
      )}
    </div>
  );
}

// ─── Credential Card ──────────────────────────────────────────────────────────

interface CredentialCardProps {
  cred: {
    id: number; serviceName: string; username: string;
    encryptedPassword: string; iv: string; notes?: string | null;
    subscriptionStart?: string | Date | null; subscriptionDays?: number | null;
  };
  masterPassword: string;
  onEdit: () => void;
  onDelete: () => void;
}

function CredentialCard({ cred, masterPassword, onEdit, onDelete }: CredentialCardProps) {
  const [showPass, setShowPass] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const daysRemaining = getDaysRemaining(cred.subscriptionStart, cred.subscriptionDays);
  const isUrgent = daysRemaining !== null && daysRemaining <= 7;

  const handleReveal = async () => {
    if (showPass) { setShowPass(false); return; }
    if (decrypted !== null) { setShowPass(true); return; }
    setDecrypting(true);
    try {
      const plain = await decryptPassword(cred.encryptedPassword, cred.iv, masterPassword);
      setDecrypted(plain); setShowPass(true);
    } catch { toast.error("Erro ao descriptografar. Verifique sua senha mestra."); }
    finally { setDecrypting(false); }
  };

  const handleCopy = async () => {
    try {
      let plain = decrypted;
      if (!plain) { plain = await decryptPassword(cred.encryptedPassword, cred.iv, masterPassword); setDecrypted(plain); }
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      toast.success("Senha copiada!", { description: `Senha de ${cred.serviceName} copiada.`, duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Erro ao copiar senha."); }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}
      className={`group relative bg-card border rounded-2xl p-5 transition-all duration-300 ${isUrgent ? "border-orange-500/40 hover:border-orange-500/70" : "border-border hover:border-primary/50 hover:glow-red"}`}
    >
      <div className="flex items-start gap-3 mb-4">
        <ServiceIcon name={cred.serviceName} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{cred.serviceName}</h3>
          <p className="text-sm text-muted-foreground truncate">{cred.username}</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" title="Criptografado" />
      </div>

      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 mb-4">
        <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 font-mono text-sm text-foreground truncate">
          {showPass && decrypted ? decrypted : "••••••••••••"}
        </span>
        <button type="button" onClick={handleReveal} disabled={decrypting} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
          {decrypting ? <span className="w-3.5 h-3.5 border border-muted-foreground border-t-foreground rounded-full animate-spin block" /> : showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {cred.notes && <p className="text-xs text-muted-foreground mb-3 truncate">{cred.notes}</p>}

      {/* Subscription badge */}
      <SubscriptionBadge subscriptionStart={cred.subscriptionStart} subscriptionDays={cred.subscriptionDays} />

      <div className={`flex items-center gap-2 ${(cred.subscriptionStart || cred.notes) ? "mt-3" : ""}`}>
        <Button size="sm" onClick={handleCopy} className={`flex-1 gap-1.5 transition-all duration-200 ${copied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "gradient-red text-primary-foreground glow-red"}`}>
          {copied ? <><Check className="w-3.5 h-3.5" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar senha</>}
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="border-border hover:border-primary/50 hover:text-primary"><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="border-border hover:border-destructive/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </motion.div>
  );
}

// ─── Main Vault ───────────────────────────────────────────────────────────────

export default function Vault() {
  const { user, masterPassword, logout } = useLocalAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<null | {
    id: number; serviceName: string; username: string; encryptedPassword: string; iv: string;
    notes: string; groupId: number | null; subscriptionStart: string; subscriptionDays: string;
  }>(null);
  const [editPlainPassword, setEditPlainPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<null | { id: number; serviceName: string }>(null);

  // Group management state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "edit">("create");
  const [groupEditTarget, setGroupEditTarget] = useState<{ id: number; name: string } | null>(null);
  const [groupName, setGroupName] = useState("");
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: number; name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const utils = trpc.useUtils();
  const { data: groups = [] } = trpc.groups.list.useQuery();
  const queryGroupId = selectedGroupId === "all" ? undefined : selectedGroupId;
  const { data: credentials = [], isLoading } = trpc.vault.list.useQuery({ search: debouncedSearch, groupId: queryGroupId });

  // Count expiring soon
  const expiringCount = useMemo(() =>
    credentials.filter((c) => {
      const d = getDaysRemaining(c.subscriptionStart, c.subscriptionDays);
      return d !== null && d >= 0 && d <= 7;
    }).length,
    [credentials]
  );

  // Group mutations
  const createGroupMutation = trpc.groups.create.useMutation({ onSuccess: () => { utils.groups.list.invalidate(); setGroupModalOpen(false); setGroupName(""); toast.success("Grupo criado!"); }, onError: () => toast.error("Erro ao criar grupo.") });
  const updateGroupMutation = trpc.groups.update.useMutation({ onSuccess: () => { utils.groups.list.invalidate(); setGroupModalOpen(false); setGroupEditTarget(null); setGroupName(""); toast.success("Grupo renomeado!"); }, onError: () => toast.error("Erro ao renomear grupo.") });
  const deleteGroupMutation = trpc.groups.delete.useMutation({
    onSuccess: () => { utils.groups.list.invalidate(); utils.vault.list.invalidate(); setDeleteGroupTarget(null); if (selectedGroupId === deleteGroupTarget?.id) setSelectedGroupId("all"); toast.success("Grupo excluído."); },
    onError: () => toast.error("Erro ao excluir grupo."),
  });

  // Credential mutations
  const createMutation = trpc.vault.create.useMutation({ onSuccess: () => { utils.vault.list.invalidate(); setAddOpen(false); toast.success("Conta adicionada!"); }, onError: () => toast.error("Erro ao salvar credencial.") });
  const updateMutation = trpc.vault.update.useMutation({ onSuccess: () => { utils.vault.list.invalidate(); setEditTarget(null); toast.success("Conta atualizada!"); }, onError: () => toast.error("Erro ao atualizar credencial.") });
  const deleteMutation = trpc.vault.delete.useMutation({ onSuccess: () => { utils.vault.list.invalidate(); setDeleteTarget(null); toast.success("Conta removida."); }, onError: () => toast.error("Erro ao excluir credencial.") });

  const handleCreate = async (data: CredentialFormData) => {
    try {
      const { ciphertext, iv } = await encryptPassword(data.plainPassword, masterPassword);
      createMutation.mutate({
        serviceName: data.serviceName, username: data.username,
        encryptedPassword: ciphertext, iv, notes: data.notes, groupId: data.groupId,
        subscriptionStart: data.subscriptionStart || null,
        subscriptionDays: data.subscriptionDays ? parseInt(data.subscriptionDays) : null,
      });
    } catch { toast.error("Erro ao criptografar senha."); }
  };

  const handleUpdate = async (data: CredentialFormData) => {
    if (!editTarget) return;
    try {
      const { ciphertext, iv } = await encryptPassword(data.plainPassword, masterPassword);
      updateMutation.mutate({
        id: editTarget.id, serviceName: data.serviceName, username: data.username,
        encryptedPassword: ciphertext, iv, notes: data.notes, groupId: data.groupId,
        subscriptionStart: data.subscriptionStart || null,
        subscriptionDays: data.subscriptionDays ? parseInt(data.subscriptionDays) : null,
      });
    } catch { toast.error("Erro ao criptografar senha."); }
  };

  const handleEditOpen = async (cred: typeof credentials[0]) => {
    try {
      const plain = await decryptPassword(cred.encryptedPassword, cred.iv, masterPassword);
      setEditPlainPassword(plain);
      // Format date for input[type=date]
      let startStr = "";
      if (cred.subscriptionStart) {
        const d = new Date(cred.subscriptionStart);
        startStr = d.toISOString().split("T")[0];
      }
      setEditTarget({
        id: cred.id, serviceName: cred.serviceName, username: cred.username,
        encryptedPassword: cred.encryptedPassword, iv: cred.iv, notes: cred.notes ?? "",
        groupId: cred.groupId ?? null,
        subscriptionStart: startStr,
        subscriptionDays: cred.subscriptionDays ? String(cred.subscriptionDays) : "",
      });
    } catch { toast.error("Erro ao descriptografar. Verifique sua senha mestra."); }
  };

  const openCreateGroup = () => { setGroupModalMode("create"); setGroupName(""); setGroupEditTarget(null); setGroupModalOpen(true); };
  const openEditGroup = (g: { id: number; name: string }) => { setGroupModalMode("edit"); setGroupName(g.name); setGroupEditTarget(g); setGroupModalOpen(true); };
  const handleGroupSave = () => {
    if (!groupName.trim()) return;
    if (groupModalMode === "create") createGroupMutation.mutate({ name: groupName.trim() });
    else if (groupEditTarget) updateGroupMutation.mutate({ id: groupEditTarget.id, name: groupName.trim() });
  };

  const currentGroupName = selectedGroupId === "all" ? "Todas as contas" : groups.find((g) => g.id === selectedGroupId)?.name ?? "Todas as contas";
  const defaultGroupId = selectedGroupId === "all" ? null : (selectedGroupId as number | null);

  return (
    <div className="min-h-screen" style={{ position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663485280303/jZHyXnwUY8zYM24krTBfV3/edh-vault-bg-oHhcWngMY2DuzsFZJupm7h.webp')`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2 }} className="flex flex-col min-h-screen">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/50 bg-card/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen((v) => !v)} className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mr-1" title="Alternar painel de grupos">
              <Layers className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 gradient-red rounded-xl flex items-center justify-center glow-red">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">EDH STORE KEYS</h1>
              <p className="text-xs text-muted-foreground">AES-256-GCM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expiringCount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-orange-400 font-medium">{expiringCount} expirando em breve</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-secondary/60 rounded-xl px-3 py-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground gap-1.5">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </motion.header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — minimalista */}
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.aside
                key="sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 200, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden border-r border-white/5 bg-black/20 backdrop-blur-sm flex-shrink-0"
              >
                <div className="w-[200px] pt-5 pb-4 px-3 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between px-2 mb-3">
                    <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">Grupos</span>
                    <button
                      onClick={openCreateGroup}
                      className="text-muted-foreground/50 hover:text-primary transition-colors"
                      title="Novo grupo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* All */}
                  <button
                    onClick={() => setSelectedGroupId("all")}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-all ${
                      selectedGroupId === "all"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {selectedGroupId === "all" && (
                      <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2 mb-0.5" />
                    )}
                    Todas
                  </button>

                  {/* Groups list */}
                  <div className="flex flex-col mt-0.5 flex-1 overflow-y-auto">
                    {groups.map((g) => (
                      <div key={g.id} className="flex items-center group/item rounded-lg hover:bg-white/5 transition-colors">
                        <button
                          onClick={() => setSelectedGroupId(g.id)}
                          className={`flex-1 min-w-0 text-left px-2 py-1.5 text-sm transition-colors truncate ${
                            selectedGroupId === g.id
                              ? "text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {selectedGroupId === g.id && (
                            <span className="inline-block w-1 h-1 rounded-full bg-primary mr-2 mb-0.5" />
                          )}
                          {g.name}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-5 h-5 flex items-center justify-center text-muted-foreground/40 opacity-0 group-hover/item:opacity-100 hover:text-muted-foreground transition-all mr-1 flex-shrink-0">
                              <MoreHorizontal className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border min-w-[130px]">
                            <DropdownMenuItem onClick={() => openEditGroup(g)} className="text-foreground cursor-pointer gap-2 text-sm"><Pencil className="w-3 h-3" /> Renomear</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteGroupTarget(g)} className="text-destructive cursor-pointer gap-2 text-sm"><Trash2 className="w-3 h-3" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>

                  {/* Empty state */}
                  {groups.length === 0 && (
                    <button
                      onClick={openCreateGroup}
                      className="mt-2 px-2 py-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors text-left"
                    >
                      + Novo grupo
                    </button>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{currentGroupName}</h2>
                <p className="text-xs text-muted-foreground">{credentials.length} {credentials.length === 1 ? "conta" : "contas"}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10 bg-card/60 border-border focus:border-primary h-10" />
                </div>
                <Button onClick={() => setAddOpen(true)} className="gradient-red text-primary-foreground font-semibold glow-red h-10 gap-2 px-4">
                  <Plus className="w-4 h-4" /><span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </motion.div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                    <div className="flex gap-3 mb-4"><div className="w-10 h-10 bg-secondary rounded-xl" /><div className="flex-1 space-y-2"><div className="h-4 bg-secondary rounded w-3/4" /><div className="h-3 bg-secondary rounded w-1/2" /></div></div>
                    <div className="h-9 bg-secondary rounded-xl mb-4" /><div className="h-8 bg-secondary rounded-xl" />
                  </div>
                ))}
              </div>
            ) : credentials.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 bg-secondary rounded-3xl flex items-center justify-center mb-4 border border-border">
                  <KeyRound className="w-9 h-9 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{debouncedSearch ? "Nenhum resultado" : selectedGroupId !== "all" ? "Grupo vazio" : "Cofre vazio"}</h2>
                <p className="text-muted-foreground text-sm max-w-xs">{debouncedSearch ? `Nenhuma conta encontrada para "${debouncedSearch}".` : selectedGroupId !== "all" ? "Adicione uma conta neste grupo." : "Adicione sua primeira conta para começar."}</p>
                {!debouncedSearch && (
                  <Button onClick={() => setAddOpen(true)} className="gradient-red text-primary-foreground font-semibold glow-red mt-6 gap-2">
                    <Plus className="w-4 h-4" />Adicionar conta
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {credentials.map((cred) => (
                    <CredentialCard key={cred.id} cred={cred} masterPassword={masterPassword} onEdit={() => handleEditOpen(cred)} onDelete={() => setDeleteTarget({ id: cred.id, serviceName: cred.serviceName })} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* Add Modal */}
      <CredentialForm open={addOpen} onClose={() => setAddOpen(false)} title="Nova conta" loading={createMutation.isPending} onSave={handleCreate} groups={groups} defaultGroupId={defaultGroupId} />

      {/* Edit Modal */}
      {editTarget && (
        <CredentialForm open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar conta" initial={{ ...editTarget, plainPassword: editPlainPassword }} loading={updateMutation.isPending} onSave={handleUpdate} groups={groups} />
      )}

      {/* Delete Credential */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-foreground">Excluir conta</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Tem certeza que deseja excluir <span className="text-foreground font-medium">{deleteTarget?.serviceName}</span>? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Modal — minimalista */}
      <Dialog open={groupModalOpen} onOpenChange={(v) => !v && setGroupModalOpen(false)}>
        <DialogContent className="bg-card/95 border-white/10 max-w-xs p-6 shadow-2xl backdrop-blur-md">
          <DialogTitle className="text-sm font-medium text-foreground mb-4">
            {groupModalMode === "create" ? "Novo grupo" : "Renomear grupo"}
          </DialogTitle>
          <Input
            placeholder="Nome do grupo..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGroupSave()}
            className="bg-secondary/60 border-white/10 focus:border-primary/60 h-9 text-sm"
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setGroupModalOpen(false)}
              className="flex-1 h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGroupSave}
              disabled={!groupName.trim() || createGroupMutation.isPending || updateGroupMutation.isPending}
              className="flex-1 h-8 rounded-lg text-xs font-semibold gradient-red text-primary-foreground disabled:opacity-40 transition-opacity"
            >
              {createGroupMutation.isPending || updateGroupMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Group */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(v) => !v && setDeleteGroupTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-foreground">Excluir grupo</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">Tem certeza que deseja excluir o grupo <span className="text-foreground font-medium">"{deleteGroupTarget?.name}"</span>? As contas dentro dele <span className="text-foreground font-medium">não serão excluídas</span>, apenas ficarão sem grupo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteGroupTarget && deleteGroupMutation.mutate({ id: deleteGroupTarget.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteGroupMutation.isPending}>
              {deleteGroupMutation.isPending ? "Excluindo..." : "Excluir grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
