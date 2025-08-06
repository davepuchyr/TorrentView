'use client';

import { TorrentClient } from '@/components/torrent-client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [backendUrl, setBackendUrl] = useState('');

  useEffect(() => {
    const storedUrl = localStorage.getItem('backendUrl');
    if (storedUrl) {
      setBackendUrl(storedUrl);
    }
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-background font-body text-foreground">
      <header className="flex-shrink-0 border-b border-border bg-card px-6 py-4 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold font-headline text-primary">
          TorrentView
        </h1>
        {backendUrl && (
          <span className="text-sm text-muted-foreground font-mono">{backendUrl}</span>
        )}
      </header>
      <main className="flex-1 overflow-y-auto">
        <TorrentClient backendUrl={backendUrl} setBackendUrl={setBackendUrl} />
      </main>
    </div>
  );
}
