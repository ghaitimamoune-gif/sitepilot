'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <button onClick={logout} style={{
      padding: '6px 14px', background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 7, color: 'var(--text2)', fontSize: 11, cursor: 'pointer',
      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '0.5px',
    }}>
      DÉCONNEXION
    </button>
  )
}
