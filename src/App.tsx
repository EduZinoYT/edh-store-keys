import { useAuth } from './contexts/AuthContext'
import Auth from './pages/Auth'
import Vault from './pages/Vault'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return session ? <Vault /> : <Auth />
}
