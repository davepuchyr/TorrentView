"use client";

import { useState, useMemo } from 'react';
import { torrents as mockTorrents } from '@/lib/data';
import type { Torrent } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { TorrentTable } from '@/components/torrent-table';
import { Search } from 'lucide-react';

export function TorrentClient() {
  // In a real application, this data would be fetched from the qBittorrent API.
  const [torrents] = useState<Torrent[]>(mockTorrents); 
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Torrent;
    direction: 'ascending' | 'descending';
  } | null>({ key: 'added_on', direction: 'descending' });

  const filteredAndSortedTorrents = useMemo(() => {
    let processableTorrents = [...torrents];

    if (filter) {
      processableTorrents = processableTorrents.filter((torrent) =>
        torrent.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (sortConfig !== null) {
      processableTorrents.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return processableTorrents;
  }, [torrents, filter, sortConfig]);

  const handleSort = (key: keyof Torrent) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter torrents by name..."
          className="pl-10 w-full max-w-sm bg-card"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter torrents"
        />
      </div>
      <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
        <TorrentTable
          torrents={filteredAndSortedTorrents}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
