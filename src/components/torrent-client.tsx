"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { torrents as mockTorrents } from '@/lib/data';
import type { Torrent, SortConfig } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TorrentTable } from '@/components/torrent-table';
import { Search, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TorrentClient() {
  const { toast } = useToast();
  const [torrents, setTorrents] = useState<Torrent[]>(mockTorrents); 
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([
    { key: 'added_on', direction: 'descending' }
  ]);
  const [selectedTorrent, setSelectedTorrent] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleRowClick = (hash: string) => {
    setSelectedTorrent(hash);
    setTorrents(prevTorrents =>
      prevTorrents.map(t =>
        t.hash === hash && !t.is_read ? { ...t, is_read: true } : t
      )
    );
  };

  const getDisplayName = (torrent: Torrent) => {
    if (torrent.resolution && torrent.resolution < 1080) {
      return torrent.name.replace(`${torrent.resolution}p`, `0${torrent.resolution}p`);
    }
    return torrent.name;
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
          } else if (config.key === 'name') {
            aValue = getDisplayName(a);
            bValue = getDisplayName(b);
          } else {
            aValue = a[config.key as keyof Torrent];
            bValue = b[config.key as keyof Torrent];
          }
          
          if (config.key === 'resolution') {
            aValue = aValue ?? 0;
            bValue = bValue ?? 0;
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
      const existingIndex = prevConfig.findIndex(c => c.key === key);
  
      if (existingIndex > -1) {
        // Key exists, flip direction
        const newConfig = [...prevConfig];
        newConfig[existingIndex] = {
          ...newConfig[existingIndex],
          direction: newConfig[existingIndex].direction === 'ascending' ? 'descending' : 'ascending'
        };
        return newConfig;
      } else {
        // Key doesn't exist
        if (isShiftClick) {
          // Add to existing sort
          return [...prevConfig, { key, direction: 'ascending' }];
        } else {
          // Replace sort
          return [{ key, direction: 'ascending' }];
        }
      }
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
  
  useEffect(() => {
    const storedUrl = localStorage.getItem('backendUrl');
    if (storedUrl) {
      setBackendUrl(storedUrl);
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('backendUrl', backendUrl);
    setIsSettingsOpen(false);
    toast({
      title: 'Settings Saved',
      description: 'Your backend URL has been updated.',
    });
  };


  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-grow max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter torrents by name..."
            className="pl-10 w-full bg-card"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter torrents"
          />
        </div>
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Backend Settings</DialogTitle>
              <DialogDescription>
                Configure the URL for connecting to the qBittorrent backend.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="backend-url" className="text-right">
                  URL
                </Label>
                <Input
                  id="backend-url"
                  className="col-span-3"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="http://localhost:8080"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSaveSettings}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
