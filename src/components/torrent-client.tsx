"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { torrents as mockTorrents } from '@/lib/data';
import type { Torrent, SortConfig } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { TorrentTable } from '@/components/torrent-table';
import { Search } from 'lucide-react';

export function TorrentClient() {
  const [torrents, setTorrents] = useState<Torrent[]>(mockTorrents); 
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([
    { key: 'added_on', direction: 'descending' }
  ]);
  const [selectedTorrent, setSelectedTorrent] = useState<string | null>(null);

  const handleRowClick = (hash: string) => {
    setSelectedTorrent(hash);
    setTorrents(prevTorrents =>
      prevTorrents.map(t =>
        t.hash === hash && !t.is_read ? { ...t, is_read: true } : t
      )
    );
  };

  const filteredAndSortedTorrents = useMemo(() => {
    let processableTorrents = [...torrents];

    if (filter) {
      processableTorrents = processableTorrents.filter((torrent) =>
        torrent.name.toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (sortConfig.length > 0) {
      processableTorrents.sort((a, b) => {
        for (const config of sortConfig) {
          let aValue: any;
          let bValue: any;

          if (config.key === 'type') {
            const getType = (t: Torrent) => {
              if (!t.resolution) return 2; // Other
              if (t.is_series) return 0; // Series
              return 1; // Movie
            };
            aValue = getType(a);
            bValue = getType(b);
          } else {
            aValue = a[config.key as keyof Torrent];
            bValue = b[config.key as keyof Torrent];
          }

          if (aValue < bValue) {
            return config.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return config.direction === 'ascending' ? 1 : -1;
          }
        }
        return 0;
      });
    }

    return processableTorrents;
  }, [torrents, filter, sortConfig]);
  
  const handleSort = (key: keyof Torrent | 'type', isShiftClick: boolean) => {
    setSortConfig(prevConfig => {
      const newConfig = isShiftClick ? [...prevConfig] : [];
      const existingIndex = newConfig.findIndex(c => c.key === key);

      if (existingIndex > -1) {
        // The key exists, just flip its direction
        newConfig[existingIndex] = {
          ...newConfig[existingIndex],
          direction: newConfig[existingIndex].direction === 'ascending' ? 'descending' : 'ascending'
        };
      } else {
        // The key doesn't exist, add it
        newConfig.push({ key, direction: 'ascending' });
      }
      return newConfig;
    });
  };

  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        const currentIndex = filteredAndSortedTorrents.findIndex(t => t.hash === selectedTorrent);
        const nextIndex = (currentIndex + 1) % filteredAndSortedTorrents.length;
        handleRowClick(filteredAndSortedTorrents[nextIndex].hash);
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        const currentIndex = filteredAndSortedTorrents.findIndex(t => t.hash === selectedTorrent);
        const prevIndex = (currentIndex - 1 + filteredAndSortedTorrents.length) % filteredAndSortedTorrents.length;
        handleRowClick(filteredAndSortedTorrents[prevIndex].hash);
    }
  }, [filteredAndSortedTorrents, selectedTorrent, handleRowClick]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);


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
          selectedTorrent={selectedTorrent}
          onRowClick={handleRowClick}
        />
      </div>
    </div>
  );
}
