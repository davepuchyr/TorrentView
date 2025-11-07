import { NextRequest } from "next/server";
import type { Article, Feed, Torrent } from "@/lib/types";

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
      return new Response("Missing backendUrl parameter", { status: 400 });
   }

   // Create SSE response
   const encoder = new TextEncoder();
   const stream = new ReadableStream({
      start(controller) {
         // Send initial connection message
         controller.enqueue(encoder.encode('data: {"type": "connected"}\n\n'));

         let lastURLs: string[] = [];
         let intervalId: NodeJS.Timeout;

         const fetchTorrents = async () => {
            try {
               const urlRSS = `${backendUrl}/api/v2/rss/items?withData=true`; // HARD-CODED
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
               const torrents = new Map<string, Torrent>();
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
                     torrents.set(torrent.hash, torrent);
                  }
               }

               const currentURLs = torrents.keys().toArray();
               let changed = currentURLs.length != lastURLs.length;
               for (let i = 0, n = currentURLs.length; !changed && i < n; ++i) {
                  if (currentURLs[i] != lastURLs[i]) changed = true;
               }

               if (changed) {
                  lastURLs = currentURLs;
                  controller.enqueue(
                     encoder.encode(
                        `data: ${JSON.stringify({
                           type: "update",
                           torrents: torrents.values().toArray(),
                        })}\n\n`,
                     ),
                  );
               }
            } catch (error) {
               console.error("Error fetching torrents:", error);
               controller.enqueue(
                  encoder.encode(
                     `data: ${JSON.stringify({
                        type: "error",
                        message: "Failed to fetch torrent data",
                     })}\n\n`,
                  ),
               );
            }
         };

         // Initial fetch
         fetchTorrents();

         // Set up polling every 7 minutes in conjunction with the 15 minute refresh cycle in qbittorrent
         intervalId = setInterval(fetchTorrents, 7 * 1000 * 60); // HARD-CODED

         // Handle client disconnect
         request.signal.addEventListener("abort", () => {
            clearInterval(intervalId);
            controller.close();
         });
      },
   });

   return new Response(stream, {
      headers: {
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache",
         "Connection": "keep-alive",
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Headers": "Cache-Control",
      },
   });
}

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return new Response("Missing backendUrl parameter", { status: 400 });
   }

   const body = await request.json();
   const feed = encodeURIComponent(body.feed);
   const id = encodeURIComponent(body.id);
   const url = `${backendUrl}/api/v2/rss/markAsRead`;

   try {
      const fetched = await fetch(url, {
         headers: {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "sec-gpc": "1",
         },
         referrer: `${backendUrl}/`,
         body: `itemPath=${feed}&articleId=${id}`,
         method: "POST",
         mode: "cors",
         credentials: "include",
      });
      console.log(`Marked ${body.feed}.${body.id} as read.`);
   } catch (e) {
      return new Response("Failed to POST to ${url}", { status: 502 });
   }

   return new Response("ok", { status: 200 });
}
