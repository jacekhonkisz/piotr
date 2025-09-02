import React from 'react';

export const metadata = {
  title: 'Test App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div>Minimal Layout Test</div>
        {children}
      </body>
    </html>
  );
}
