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
      const stream = new ReadableStream({
         start(controller) {
            const message = `data: ${JSON.stringify({ type: "error", message: "Missing backendUrl parameter" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
            controller.close();
         },
      });
      return new Response(stream, {
         headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
   }

   const urlRSS = `${backendUrl}/api/v2/rss/items?withData=true`;

   const stream = new ReadableStream({
      async start(controller) {
         const sendEvent = (data: object) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
         };

         const fetchData = async () => {
            try {
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
               sendEvent({ type: "torrents", data: torrents });
               sendEvent({ type: "status", message: "connected" });
            } catch (error: any) {
               console.error("Error fetching torrents:", error);
               sendEvent({ type: "error", message: error.message || "Failed to fetch torrent data" });
               // Don't close the stream on fetch error to allow for retries
            }
         };

         await fetchData();
         const intervalId = setInterval(fetchData, 7000);

         // It seems there's no direct way to detect client disconnect in a standard Next.js route handler
         // to clear the interval. The connection will be closed by the server/client eventually.
         // For long-running processes, a more robust solution with a proper lifecycle might be needed.
      },
   });

   return new Response(stream, {
      headers: {
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache",
         "Connection": "keep-alive",
      },
   });
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
   let fetched: Response;

   try {
      fetched = await fetch(url, {
         headers: {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
         },
         body: `itemPath=${feed}&articleId=${id}`,
         method: "POST",
      });
      if (fetched.status == 200) console.log(`Marked ${body.feed}.${body.id} as read.`);
   } catch (e) {
      console.error(`Failed to mark ${body.feed}.${body.id} as read:`, e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }

   return new NextResponse(fetched.body, { status: fetched.status, headers: fetched.headers });
}
