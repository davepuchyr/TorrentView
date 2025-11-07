import { NextRequest } from "next/server";
import type { Article, Feed } from "@/lib/types";

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
               const feeds = Object.values(rss) as Feed[];
               const articles: Article[] = feeds.flatMap(feed => feed.articles);
               const articlesDeduped = articles.reduce((torrents: Map<string, Article>, t: Article) => {
                  torrents.set(t.torrentURL, t);
                  return torrents;
               }, new Map<string, Article>());
               const currentURLs = articlesDeduped.keys().toArray();

               let changed = currentURLs.length != lastURLs.length;
               for (let i = 0, n = currentURLs.length; !changed && i < n; ++i) {
                  changed = currentURLs[i] != lastURLs[i];
               }

               if (changed) {
                  lastURLs = currentURLs;
                  controller.enqueue(
                     encoder.encode(
                        `data: ${JSON.stringify({
                           type: "update",
                           articles: articlesDeduped.values().toArray(),
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
         intervalId = setInterval(fetchTorrents, 7 * 1000 * 60);

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
