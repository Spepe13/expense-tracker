import './globals.css'

export const metadata = {
  title: 'Διαχείριση Οικονομικών',
  description: 'Παρακολούθησε τις δόσεις και τα έξοδά σου',
  manifest: '/manifest.json',
  themeColor: '#1e293b',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Έξοδα',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="el">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
