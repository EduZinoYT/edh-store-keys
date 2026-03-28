import { useState } from 'react'
import { Eye, EyeOff, Lock, Shield, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createUser, getUserByUsername } from '../lib/storage'
import { base64ToSalt, generateSalt, hashPassword, saltToBase64 } from '../lib/crypto'

const BG_URL = 'https://cdn-uploads.huggingface.co/production/uploads/noauth/kJLHFJnvGUKMzFDxbBnVr.jpeg'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { score, label: 'Muito fraca', color: '#ef4444' }
  if (score === 2) return { score, label: 'Fraca', color: '#f97316' }
  if (score === 3) return { score, label: 'Média', color: '#eab308' }
  if (score === 4) return { score, label: 'Forte', color: '#22c55e' }
  return { score, label: 'Muito forte', color: '#16a34a' }
}

export default function Auth() {
  const { login } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = getPasswordStrength(password)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) return
    setLoading(true)
    try {
      const user = getUserByUsername(username.trim())
      if (!user) { setError('Usuário não encontrado.'); return }
      const salt = base64ToSalt(user.salt)
      const hash = await hashPassword(password, salt)
      if (hash !== user.passwordHash) { setError('Senha incorreta.'); return }
      login({
        userId: user.id,
        username: user.username,
        name: user.name,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Digite seu nome.'); return }
    if (!username.trim()) { setError('Digite um usuário.'); return }
    if (username.trim().length < 3) { setError('Usuário deve ter pelo menos 3 caracteres.'); return }
    if (password.length < 8) { setError('Senha deve ter pelo menos 8 caracteres.'); return }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const salt = generateSalt()
      const passwordHash = await hashPassword(password, salt)
      const user = createUser({ name: name.trim(), username: username.trim(), passwordHash, salt: saltToBase64(salt) })
      login({
        userId: user.id,
        username: user.username,
        name: user.name,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
        setError('Este usuário já está cadastrado. Tente outro nome.')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/40 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">EDH STORE KEYS</h1>
          <p className="text-sm text-foreground-muted mt-1">Cofre de senhas seguro e criptografado</p>
        </div>

        {/* Card */}
        <div className="bg-surface-2/95 backdrop-blur-md border border-border rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-xl bg-surface-3 p-1 mb-6">
            <button
              onClick={() => { setTab('login'); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'login' ? 'bg-primary text-white shadow' : 'text-foreground-muted hover:text-foreground'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setTab('register'); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'register' ? 'bg-primary text-white shadow' : 'text-foreground-muted hover:text-foreground'}`}
            >
              Criar conta
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Usuário</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Ex: EduZino123"
                    className="w-full bg-surface-3 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-surface-3 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Entrando...' : 'Entrar no cofre'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-surface-3 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Usuário</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Ex: EduZino123"
                    className="w-full bg-surface-3 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-surface-3 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
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
                <label className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">Confirmar senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full bg-surface-3 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted mt-4 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-primary" />
            Senhas criptografadas com <span className="text-primary font-semibold">AES-256-GCM</span> no seu navegador
          </p>
        </div>
      </div>
    </div>
  )
}
