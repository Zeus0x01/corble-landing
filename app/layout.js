import '../app/globals.css';

export const metadata = {
  title: 'Corble | Decisions, not dashboards.',
  description:
    'Corble builds practical websites and automation systems that help real businesses work smarter — results, not another tool to babysit.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
