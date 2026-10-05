import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

/**
 * Static HTML shell for the web build. Gives crawlers and the browser tab a
 * real title before the JS bundle (and fonts) load; the runtime `Head` in
 * the root layout keeps it in sync afterwards.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="apple-mobile-web-app-title" content="Bodfit" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
