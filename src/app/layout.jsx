import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'Jarvis',
  description: 'Jarvis Desktop Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <div style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          background: 'var(--bg-base)',
        }}>
          <Sidebar />
          <main style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Titlebar drag region */}
            <div className="drag-region" style={{ height: 36, flexShrink: 0 }} />
            <div style={{
              flex: 1,
              overflow: 'hidden',
              padding: '0 24px 24px 24px',
            }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
