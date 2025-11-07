export type Article = {
   category: string;
   contentLength: string;
   date: string;
   fileName: string;
   id: string;
   infoHash: string;
   isRead: boolean;
   link: string;
   magnetURI: string;
   peers: string;
   seeds: string;
   title: string;
   torrentURL: string;
   verified: string;
};

export type Feed = {
   articles: Article[];
   hasError: boolean;
   isLoading: boolean;
   lastBuildDate: string;
   title: string;
   uid: string;
   url: string;
};

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
   is_series: boolean;
   resolution: number | null;
   is_read: boolean;
   files?: TorrentFile[];
};

export type TorrentFile = {
   name: string;
   size: number;
   progress: number;
};

export type TorrentStatus = "downloading" | "seeding" | "completed" | "paused" | "error";

export type SortConfig = {
   key: keyof Torrent | "type";
   direction: "ascending" | "descending";
};
