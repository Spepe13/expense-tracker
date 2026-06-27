import './globals.css'
export const metadata = {
  title: 'Διαχείριση Οικονομικών',
  description: 'Παρακολούθησε τις δόσεις και τα έξοδά σου',
  manifest: '/manifest.json',
  themeColor: '#1e293b',
}
export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
