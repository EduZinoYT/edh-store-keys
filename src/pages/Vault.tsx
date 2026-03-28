import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Copy, Edit2,
  Eye, EyeOff, FolderPlus, Key, LogOut, MoreHorizontal, Plus,
  Search, Shield, Trash2, X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createCredential, createGroup, deleteCredential, deleteGroup,
  getCredentials, getGroups, updateCredential, updateGroup,
  type Credential, type CredentialGroup
} from '../lib/storage'
import { base64ToSalt, decryptText, deriveKey, encryptText, generateSalt, saltToBase64 } from '../lib/crypto'
import { getUserById } from '../lib/storage'

const BG_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png'

function getDaysLeft(start: string | null, days: number | null): number | null {
  if (!start || !days) return null
  const startDate = new Date(start)
  const endDate = new Date(startDate.getTime() + days * 86400000)
  return Math.ceil((endDate.getTime() - Date.now()) / 86400000)
}

function getExpiryColor(daysLeft: number | null) {
  if (daysLeft === null) return null
  if (daysLeft < 0) return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Expirado' }
  if (daysLeft <= 3) return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: `${daysLeft}d restantes` }
  if (daysLeft <= 7) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: `${daysLeft}d restantes` }
  if (daysLeft <= 14) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: `${daysLeft}d restantes` }
  return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: `${daysLeft}d restantes` }
}

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const colors = ['#ef4444', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']
  const labels = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte']
  return { score, color: colors[score] || '#ef4444', label: labels[score] || '' }
}

interface FormData {
  serviceName: string
  username: string
  password: string
  notes: string
  groupId: string
  subscriptionStart: string
  subscriptionDays: string
}

const emptyForm: FormData = {
  serviceName: '', username: '', password: '', notes: '',
  groupId: '', subscriptionStart: '', subscriptionDays: ''
}

const QUICK_DAYS = [7, 14, 30, 90, 365]

export default function Vault() {
  const { session, logout } = useAuth()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [groups, setGroups] = useState<CredentialGroup[]>([])
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)
  const [deletingCred, setDeletingCred] = useState<Credential | null>(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CredentialGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<CredentialGroup | null>(null)
  const [groupName, setGroupName] = useState('')

  // Form
  const [form, setForm] = useState<FormData>(emptyForm)
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Visible passwords
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [decryptedPasswords, setDecryptedPasswords] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Crypto key
  const cryptoKeyRef = useRef<CryptoKey | null>(null)
  const [keyReady, setKeyReady] = useState(false)
  const [masterPassword, setMasterPassword] = useState('')
  const [showKeyPrompt, setShowKeyPrompt] = useState(false)
  const [keyError, setKeyError] = useState('')

  const userId = session?.userId || ''

  useEffect(() => {
    if (!userId) return
    setGroups(getGroups(userId))
    setCredentials(getCredentials(userId, search, selectedGroup))
  }, [userId, search, selectedGroup])

  const refreshData = () => {
    setGroups(getGroups(userId))
    setCredentials(getCredentials(userId, search, selectedGroup))
  }

  // Derive crypto key from master password
  const unlockKey = async (pwd: string) => {
    const user = getUserById(userId)
    if (!user) return false
    try {
      const salt = base64ToSalt(user.salt)
      const key = await deriveKey(pwd, salt)
      cryptoKeyRef.current = key
      setKeyReady(true)
      setShowKeyPrompt(false)
      setKeyError('')
      return true
    } catch {
      return false
    }
  }

  const ensureKey = (): boolean => {
    if (cryptoKeyRef.current) return true
    setShowKeyPrompt(true)
    return false
  }

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await unlockKey(masterPassword)
    if (!ok) setKeyError('Senha incorreta.')
    else setMasterPassword('')
  }

  // Copy password
  const handleCopy = async (cred: Credential) => {
    if (!ensureKey()) return
    try {
      const plain = decryptedPasswords[cred.id] || await decryptText(cred.encryptedPassword, cred.iv, cryptoKeyRef.current!)
      await navigator.clipboard.writeText(plain)
      setCopiedId(cred.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  // Toggle show password
  const handleTogglePassword = async (cred: Credential) => {
    if (!ensureKey()) return
    if (visiblePasswords.has(cred.id)) {
      setVisiblePasswords(prev => { const s = new Set(prev); s.delete(cred.id); return s })
      return
    }
    try {
      if (!decryptedPasswords[cred.id]) {
        const plain = await decryptText(cred.encryptedPassword, cred.iv, cryptoKeyRef.current!)
        setDecryptedPasswords(prev => ({ ...prev, [cred.id]: plain }))
      }
      setVisiblePasswords(prev => new Set([...prev, cred.id]))
    } catch { /* ignore */ }
  }

  // Open add modal
  const openAdd = () => {
    if (!ensureKey()) return
    setForm(emptyForm)
    setFormError('')
    setShowFormPassword(false)
    setShowAddModal(true)
  }

  // Open edit modal
  const openEdit = async (cred: Credential) => {
    if (!ensureKey()) return
    try {
      const plain = decryptedPasswords[cred.id] || await decryptText(cred.encryptedPassword, cred.iv, cryptoKeyRef.current!)
      setDecryptedPasswords(prev => ({ ...prev, [cred.id]: plain }))
      setForm({
        serviceName: cred.serviceName,
        username: cred.username,
        password: plain,
        notes: cred.notes,
        groupId: cred.groupId || '',
        subscriptionStart: cred.subscriptionStart ? cred.subscriptionStart.split('T')[0] : '',
        subscriptionDays: cred.subscriptionDays?.toString() || '',
      })
      setFormError('')
      setShowFormPassword(false)
      setEditingCred(cred)
    } catch { /* ignore */ }
  }

  // Save credential
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.serviceName.trim()) { setFormError('Nome do serviço é obrigatório.'); return }
    if (!form.username.trim()) { setFormError('Usuário/email é obrigatório.'); return }
    if (!form.password) { setFormError('Senha é obrigatória.'); return }
    if (!cryptoKeyRef.current) { setFormError('Chave de criptografia não disponível.'); return }
    setFormLoading(true)
    try {
      const { ciphertext, iv } = await encryptText(form.password, cryptoKeyRef.current)
      const data = {
        userId,
        groupId: form.groupId || null,
        serviceName: form.serviceName.trim(),
        username: form.username.trim(),
        encryptedPassword: ciphertext,
        iv,
        notes: form.notes.trim(),
        subscriptionStart: form.subscriptionStart || null,
        subscriptionDays: form.subscriptionDays ? parseInt(form.subscriptionDays) : null,
      }
      if (editingCred) {
        updateCredential(editingCred.id, userId, data)
        setDecryptedPasswords(prev => ({ ...prev, [editingCred.id]: form.password }))
        setEditingCred(null)
      } else {
        createCredential(data)
        setShowAddModal(false)
      }
      refreshData()
    } catch {
      setFormError('Erro ao salvar. Tente novamente.')
    } finally {
      setFormLoading(false)
    }
  }

  // Delete credential
  const handleDelete = (cred: Credential) => {
    deleteCredential(cred.id, userId)
    setDeletingCred(null)
    refreshData()
  }

  // Groups
  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return
    if (editingGroup) {
      updateGroup(editingGroup.id, userId, groupName)
      setEditingGroup(null)
    } else {
      createGroup(userId, groupName)
    }
    setGroupName('')
    setShowGroupModal(false)
    refreshData()
  }

  const handleDeleteGroup = (g: CredentialGroup) => {
    deleteGroup(g.id, userId)
    if (selectedGroup === g.id) setSelectedGroup(null)
    setDeletingGroup(null)
    refreshData()
  }

  const expiringSoon = credentials.filter(c => {
    const d = getDaysLeft(c.subscriptionStart, c.subscriptionDays)
    return d !== null && d >= 0 && d <= 7
  })

  const ModalWrapper = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-2 border border-border rounded-2xl shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )

  const CredentialForm = ({ onClose, title }: { onClose: () => void; title: string }) => {
    const strength = getPasswordStrength(form.password)
    return (
      <ModalWrapper onClose={onClose}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Serviço *</label>
            <input value={form.serviceName} onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
              placeholder="Ex: Google, Netflix, Instagram"
              className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Usuário / Email *</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="usuario@email.com"
              className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Senha *</label>
            <div className="relative">
              <input type={showFormPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••••••"
                className="w-full bg-surface-3 border border-border rounded-xl px-4 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
              <button type="button" onClick={() => setShowFormPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ background: i <= strength.score ? strength.color : '#333' }} />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Grupo</label>
            <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
              className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors">
              <option value="">Sem grupo</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informações adicionais..."
              rows={2}
              className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>
          {/* Subscription */}
          <div className="border border-border/50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Validade da assinatura
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Data de início</label>
                <input type="date" value={form.subscriptionStart} onChange={e => setForm(f => ({ ...f, subscriptionStart: e.target.value }))}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Duração (dias)</label>
                <input type="number" min="1" value={form.subscriptionDays} onChange={e => setForm(f => ({ ...f, subscriptionDays: e.target.value }))}
                  placeholder="30"
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DAYS.map(d => (
                <button key={d} type="button" onClick={() => setForm(f => ({ ...f, subscriptionDays: d.toString() }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${form.subscriptionDays === d.toString() ? 'bg-primary text-white' : 'bg-surface-3 text-muted hover:text-foreground border border-border'}`}>
                  {d === 365 ? '1 ano' : d === 90 ? '3 meses' : d === 30 ? '1 mês' : `${d}d`}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-surface-3 hover:bg-surface-4 text-foreground-muted font-medium py-2.5 rounded-xl transition-colors text-sm">Cancelar</button>
            <button type="submit" disabled={formLoading} className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm">
              {formLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </ModalWrapper>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSidebar(v => !v)} className="text-muted hover:text-foreground transition-colors p-1">
            {showSidebar ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm tracking-tight">EDH STORE KEYS</span>
          </div>
          {expiringSoon.length > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {expiringSoon.length} expirando em breve
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted hidden sm:block">Olá, <span className="text-foreground font-medium">{session?.name}</span></span>
          {!keyReady && (
            <button onClick={() => setShowKeyPrompt(true)} className="flex items-center gap-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Key className="w-3.5 h-3.5" /> Desbloquear
            </button>
          )}
          {keyReady && <div className="flex items-center gap-1 text-green-400 text-xs"><Check className="w-3.5 h-3.5" /> Desbloqueado</div>}
          <button onClick={logout} className="text-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-48 bg-surface-2 border-r border-border flex flex-col shrink-0">
            <div className="p-3 border-b border-border">
              <button
                onClick={() => { setShowGroupModal(true); setEditingGroup(null); setGroupName('') }}
                className="w-full flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors py-1.5 px-2 rounded-lg hover:bg-surface-3"
              >
                <FolderPlus className="w-3.5 h-3.5 text-primary" /> Novo grupo
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedGroup === null ? 'text-foreground bg-surface-3' : 'text-foreground-muted hover:text-foreground hover:bg-surface-3/50'}`}
              >
                Todas as contas
                <span className="float-right text-xs text-muted">{getCredentials(userId).length}</span>
              </button>
              {groups.map(g => (
                <div key={g.id} className="group relative">
                  <button
                    onClick={() => setSelectedGroup(g.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors pr-8 ${selectedGroup === g.id ? 'text-foreground bg-surface-3' : 'text-foreground-muted hover:text-foreground hover:bg-surface-3/50'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {selectedGroup === g.id && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                      <span className="truncate">{g.name}</span>
                    </span>
                    <span className="float-right text-xs text-muted">{getCredentials(userId, undefined, g.id).length}</span>
                  </button>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setDeletingGroup(g)}
                        className="p-1 text-muted hover:text-red-400 transition-colors rounded"
                        title="Excluir grupo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contas..."
                className="w-full bg-surface-3 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Nova conta
            </button>
          </div>

          {/* Credentials list */}
          <div className="flex-1 overflow-y-auto p-4">
            {credentials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-surface-3 flex items-center justify-center mb-4">
                  <Key className="w-8 h-8 text-muted" />
                </div>
                <p className="text-foreground-muted font-medium">Nenhuma conta encontrada</p>
                <p className="text-sm text-muted mt-1">Clique em "Nova conta" para adicionar</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {credentials.map(cred => {
                  const daysLeft = getDaysLeft(cred.subscriptionStart, cred.subscriptionDays)
                  const expiry = getExpiryColor(daysLeft)
                  const group = groups.find(g => g.id === cred.groupId)
                  const isVisible = visiblePasswords.has(cred.id)
                  const isCopied = copiedId === cred.id

                  return (
                    <div key={cred.id} className="bg-surface-2 border border-border rounded-xl p-4 hover:border-border-light transition-all group animate-fade-in">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm truncate">{cred.serviceName}</h3>
                          {group && (
                            <span className="text-xs text-primary/80 flex items-center gap-1 mt-0.5">
                              <span className="w-1 h-1 rounded-full bg-primary" /> {group.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(cred)} className="p-1.5 text-muted hover:text-foreground hover:bg-surface-3 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingCred(cred)} className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted shrink-0">Usuário</span>
                          <span className="text-xs text-foreground truncate flex-1">{cred.username}</span>
                          <button onClick={() => { navigator.clipboard.writeText(cred.username) }} className="text-muted hover:text-foreground transition-colors shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted shrink-0">Senha</span>
                          <span className="text-xs text-foreground flex-1 font-mono">
                            {isVisible && decryptedPasswords[cred.id] ? decryptedPasswords[cred.id] : '••••••••••'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleTogglePassword(cred)} className="text-muted hover:text-foreground transition-colors">
                              {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button onClick={() => handleCopy(cred)} className="text-muted hover:text-primary transition-colors">
                              {isCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {expiry && (
                        <div className={`mt-3 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${expiry.bg} ${expiry.text} ${expiry.border}`}>
                          <Clock className="w-3 h-3 shrink-0" />
                          {expiry.label}
                          {daysLeft !== null && daysLeft >= 0 && cred.subscriptionDays && (
                            <div className="ml-auto flex-1 max-w-16 bg-black/20 rounded-full h-1 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (daysLeft / cred.subscriptionDays) * 100))}%`, background: expiry.text.replace('text-', '') === 'green-400' ? '#22c55e' : expiry.text.includes('red') ? '#ef4444' : expiry.text.includes('orange') ? '#f97316' : '#eab308' }} />
                            </div>
                          )}
                        </div>
                      )}

                      {cred.notes && (
                        <p className="mt-2 text-xs text-muted truncate">{cred.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Key prompt modal */}
      {showKeyPrompt && (
        <ModalWrapper onClose={() => setShowKeyPrompt(false)}>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Desbloquear cofre</h2>
                <p className="text-xs text-muted">Digite sua senha para descriptografar</p>
              </div>
            </div>
            <form onSubmit={handleKeySubmit} className="space-y-3">
              <input
                type="password"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                placeholder="Sua senha de acesso"
                autoFocus
                className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
              {keyError && <p className="text-xs text-red-400">{keyError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowKeyPrompt(false)} className="flex-1 bg-surface-3 text-foreground-muted py-2.5 rounded-xl text-sm transition-colors hover:bg-surface-4">Cancelar</button>
                <button type="submit" className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Desbloquear</button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* Add modal */}
      {showAddModal && <CredentialForm onClose={() => setShowAddModal(false)} title="Nova conta" />}

      {/* Edit modal */}
      {editingCred && <CredentialForm onClose={() => setEditingCred(null)} title="Editar conta" />}

      {/* Delete credential confirm */}
      {deletingCred && (
        <ModalWrapper onClose={() => setDeletingCred(null)}>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Excluir conta</h2>
                <p className="text-xs text-muted">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-foreground-muted mb-4">Tem certeza que deseja excluir <span className="text-foreground font-medium">{deletingCred.serviceName}</span>?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingCred(null)} className="flex-1 bg-surface-3 text-foreground-muted py-2.5 rounded-xl text-sm transition-colors hover:bg-surface-4">Cancelar</button>
              <button onClick={() => handleDelete(deletingCred)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Excluir</button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Group modal */}
      {showGroupModal && (
        <ModalWrapper onClose={() => { setShowGroupModal(false); setGroupName('') }}>
          <div className="p-5">
            <h2 className="font-semibold text-foreground mb-4">{editingGroup ? 'Renomear grupo' : 'Novo grupo'}</h2>
            <form onSubmit={handleSaveGroup} className="space-y-3">
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ex: Contas Google, Redes Sociais..."
                autoFocus
                className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowGroupModal(false); setGroupName('') }} className="flex-1 bg-surface-3 text-foreground-muted py-2.5 rounded-xl text-sm transition-colors hover:bg-surface-4">Cancelar</button>
                <button type="submit" className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* Delete group confirm */}
      {deletingGroup && (
        <ModalWrapper onClose={() => setDeletingGroup(null)}>
          <div className="p-5">
            <h2 className="font-semibold text-foreground mb-2">Excluir grupo</h2>
            <p className="text-sm text-foreground-muted mb-4">Excluir <span className="text-foreground font-medium">{deletingGroup.name}</span>? As contas do grupo não serão excluídas.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingGroup(null)} className="flex-1 bg-surface-3 text-foreground-muted py-2.5 rounded-xl text-sm transition-colors hover:bg-surface-4">Cancelar</button>
              <button onClick={() => handleDeleteGroup(deletingGroup)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Excluir</button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  )
}
