import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'Jarvis',
  description: 'Jarvis Desktop Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="flex h-screen w-screen overflow-hidden bg-base text-primary font-sans">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* macOS titlebar drag region */}
          <div className="drag-region h-9 shrink-0" />
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
