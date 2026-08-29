export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🏗️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>
          PAGE INTROUVABLE
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 22 }}>
          Ce projet ou cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.
        </p>
        <a href="/dashboard" style={{ padding: '9px 18px', background: 'var(--amber)', borderRadius: 8, color: '#0A0B0D', fontSize: 12, fontWeight: 800, textDecoration: 'none', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '1px' }}>
          RETOUR AUX PROJETS
        </a>
      </div>
    </div>
  )
}
