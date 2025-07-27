import { TorrentClient } from '@/components/torrent-client';

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background font-body text-foreground">
      <header className="flex-shrink-0 border-b border-border bg-card px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-bold font-headline text-primary">
          TorrentView
        </h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <TorrentClient />
      </main>
    </div>
  );
}
