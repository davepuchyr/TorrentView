export type TorrentStatus = 'downloading' | 'seeding' | 'completed' | 'paused' | 'error';

export type Torrent = {
  hash: string;
  name: string;
  size: number; // in bytes
  progress: number; // 0-1
  status: TorrentStatus;
  dlspeed: number; // bytes/s
  upspeed: number; // bytes/s
  eta: number; // seconds
  ratio: number;
  added_on: number; // timestamp
  category: string;
};
