import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

const regexSeries = /S\d{1,2}(E\d{1,2})?(.*complete)?/i;
const regexResolution = /(\d{3,4})p/i;

const getResolution = (name: string): number | null => {
   const matched = name.match(regexResolution);
   return matched ? parseInt(matched[1], 10) : null;
};

export async function GET(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   try {
      const urlRSS = `${backendUrl}/api/v2/rss/items?withData=true`;
      const response = await fetch(urlRSS, {
         headers: {
            "Content-Type": "application/json",
         },
      });

      if (!response.ok) {
         throw new Error(`Failed to fetch ${urlRSS}: ${response.status}`);
      }

      const rss = await response.json();
      const feeds = Object.keys(rss);
      const torrents: Torrent[] = [];
      for (let i = 0, n = feeds.length; i < n; ++i) {
         const feed = feeds[i];
         const articles = rss[feed].articles;
         for (let j = 0, m = articles.length; j < m; ++j) {
            const article = articles[j];

            if (article.isRead) continue;

            const series = regexSeries.test(article.title);
            const resolution = getResolution(article.title);
            const torrent: Torrent = {
               added_on: Math.floor(new Date(article.date).getTime() / 1000),
               category: series ? "TV" : resolution ? "Movie" : "Other",
               dlspeed: 0,
               eta: -1,
               feed: feed,
               hash: article.torrentURL,
               id: article.id,
               is_read: article.isRead,
               is_series: series,
               name: article.title,
               progress: 0,
               ratio: 0,
               resolution: resolution,
               size: parseInt(article.contentLength, 10) || 0,
               status: "available",
               upspeed: 0,
            };
            torrents.push(torrent);
         }
      }
      return NextResponse.json(torrents);
   } catch (error) {
      console.error("Error fetching torrents:", error);
      return NextResponse.json({ error: "Failed to fetch torrent data" }, { status: 500 });
   }
}

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   const body = await request.json();
   const feed = encodeURIComponent(body.feed);
   const id = encodeURIComponent(body.id);
   const url = `${backendUrl}/api/v2/rss/markAsRead`;

   try {
      await fetch(url, {
         headers: {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
         },
         body: `itemPath=${feed}&articleId=${id}`,
         method: "POST",
      });
      console.log(`Marked ${body.feed}.${body.id} as read.`);
      return NextResponse.json({ success: true });
   } catch (e) {
      console.error("Failed to mark as read:", e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }
}
