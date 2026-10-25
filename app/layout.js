import './globals.css'
export const metadata = {
  title: 'FinTrack - Διαχείριση Οικονομικών',
  description: 'Παρακολούθησε τα έσοδα, έξοδα και τις δόσεις σου',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
}
export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-slate-950">{children}</body>
    </html>
  )
}
