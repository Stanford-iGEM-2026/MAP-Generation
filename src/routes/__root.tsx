import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import App from '@/App';
import appCss from '@/index.css?url';

const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: 'Kele' }],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  errorComponent: ({ error }) => (
    <RootDocument>
      <App error={error} />
    </RootDocument>
  ),
});

function RootComponent() {
  return (
    <RootDocument>
      <App />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <link
          rel="icon"
          type="image/png"
          href={assetUrl('kele-logo-icon.png')}
        />
        <link rel="icon" type="image/x-icon" href={assetUrl('kele-logo.ico')} />
        <link rel="apple-touch-icon" href={assetUrl('kele-logo.png')} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
