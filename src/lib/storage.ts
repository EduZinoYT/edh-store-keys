// All data is stored in localStorage — no backend required
// Passwords are encrypted with AES-256-GCM before storage

export interface LocalUser {
  id: string
  name: string
  username: string
  passwordHash: string
  salt: string // base64
  createdAt: string
}

export interface CredentialGroup {
  id: string
  userId: string
  name: string
  createdAt: string
}

export interface Credential {
  id: string
  userId: string
  groupId: string | null
  serviceName: string
  username: string
  encryptedPassword: string
  iv: string
  notes: string
  subscriptionStart: string | null // ISO date string
  subscriptionDays: number | null
  createdAt: string
  updatedAt: string
}

const KEYS = {
  users: 'edh_users',
  groups: 'edh_groups',
  credentials: 'edh_credentials',
  session: 'edh_session',
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.users) || '[]')
  } catch {
    return []
  }
}

function saveUsers(users: LocalUser[]) {
  localStorage.setItem(KEYS.users, JSON.stringify(users))
}

export function getUserByUsername(username: string): LocalUser | undefined {
  return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase())
}

export function getUserById(id: string): LocalUser | undefined {
  return getUsers().find(u => u.id === id)
}

export function createUser(user: Omit<LocalUser, 'id' | 'createdAt'>): LocalUser {
  const users = getUsers()
  const existing = users.find(u => u.username.toLowerCase() === user.username.toLowerCase())
  if (existing) throw new Error('USERNAME_TAKEN')
  const newUser: LocalUser = {
    ...user,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, newUser])
  return newUser
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  userId: string
  username: string
  name: string
  expiresAt: string
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEYS.session)
    if (!raw) return null
    const session: Session = JSON.parse(raw)
    if (new Date(session.expiresAt) < new Date()) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEYS.session, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(KEYS.session)
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export function getGroups(userId: string): CredentialGroup[] {
  try {
    const all: CredentialGroup[] = JSON.parse(localStorage.getItem(KEYS.groups) || '[]')
    return all.filter(g => g.userId === userId).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

function saveGroups(groups: CredentialGroup[]) {
  localStorage.setItem(KEYS.groups, JSON.stringify(groups))
}

export function createGroup(userId: string, name: string): CredentialGroup {
  const all: CredentialGroup[] = JSON.parse(localStorage.getItem(KEYS.groups) || '[]')
  const group: CredentialGroup = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
  saveGroups([...all, group])
  return group
}

export function updateGroup(id: string, userId: string, name: string) {
  const all: CredentialGroup[] = JSON.parse(localStorage.getItem(KEYS.groups) || '[]')
  saveGroups(all.map(g => g.id === id && g.userId === userId ? { ...g, name: name.trim() } : g))
}

export function deleteGroup(id: string, userId: string) {
  const all: CredentialGroup[] = JSON.parse(localStorage.getItem(KEYS.groups) || '[]')
  saveGroups(all.filter(g => !(g.id === id && g.userId === userId)))
  // Unlink credentials from this group
  const creds: Credential[] = JSON.parse(localStorage.getItem(KEYS.credentials) || '[]')
  saveCredentials(creds.map(c => c.groupId === id && c.userId === userId ? { ...c, groupId: null } : c))
}

// ─── Credentials ──────────────────────────────────────────────────────────────

function saveCredentials(creds: Credential[]) {
  localStorage.setItem(KEYS.credentials, JSON.stringify(creds))
}

export function getCredentials(userId: string, search?: string, groupId?: string | null): Credential[] {
  try {
    const all: Credential[] = JSON.parse(localStorage.getItem(KEYS.credentials) || '[]')
    let filtered = all.filter(c => c.userId === userId)
    if (groupId !== undefined && groupId !== null) {
      filtered = filtered.filter(c => c.groupId === groupId)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(c =>
        c.serviceName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
      )
    }
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

export function createCredential(data: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Credential {
  const all: Credential[] = JSON.parse(localStorage.getItem(KEYS.credentials) || '[]')
  const cred: Credential = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  saveCredentials([...all, cred])
  return cred
}

export function updateCredential(id: string, userId: string, data: Partial<Omit<Credential, 'id' | 'userId' | 'createdAt'>>) {
  const all: Credential[] = JSON.parse(localStorage.getItem(KEYS.credentials) || '[]')
  saveCredentials(all.map(c =>
    c.id === id && c.userId === userId
      ? { ...c, ...data, updatedAt: new Date().toISOString() }
      : c
  ))
}

export function deleteCredential(id: string, userId: string) {
  const all: Credential[] = JSON.parse(localStorage.getItem(KEYS.credentials) || '[]')
  saveCredentials(all.filter(c => !(c.id === id && c.userId === userId)))
}
