import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

const regexDate = /\d{4}(?:[-./\s]?\d{2}){2}/;
const regexResolution = /(\d{3,4})p/i;
const regexSeries = /(S\d{1,2}(E\d{1,2})?|\d{4}(?:[-./\s]?\d{2}){2})(.*complete)?/i;
const regexSize = /\b\d+(?:\.\d+)?\s*(?:KiB|MiB|GiB|TiB)/;
const regexWhitespace = /\s{2,}/g;

const formatSize = (size: number): string => {
   if (size > 1099511627776) {
      return `${(size / 1099511627776).toFixed(2)} TiB`;
   } else if (size > 1073741824) {
      return `${(size / 1073741824).toFixed(2)} GiB`;
   } else if (size > 1048576) {
      return `${(size / 1048576).toFixed(2)} MiB`;
   } else if (size > 1024) {
      return `${(size / 1024).toFixed(2)} KiB`;
   }
   return `${size} B`;
};

const getBytes = (size: string): number | null => {
   const multiplier =
      size.indexOf("GiB") != -1
         ? 1073741824
         : size.indexOf("MiB") != -1
           ? 1048576
           : size.indexOf("KiB") != -1
             ? 1024
             : size.indexOf("TiB") != -1
               ? 1099511627776
               : 1;
   return Math.ceil(parseFloat(size) * multiplier);
};

const getResolution = (name: string): number | null => {
   const matched = name.match(regexResolution);
   return matched ? parseInt(matched[1], 10) : null;
};

const getSeries = (name: string): string | null => {
   const matched = name.match(regexSeries);
   return matched ? matched[1] : null;
};

const getSize = (name: string): string => {
   const matched = name.match(regexSize);
   return matched ? matched[0] : "?";
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
   let intervalId: string | number | NodeJS.Timeout | undefined;
   const stream = new ReadableStream({
      async start(controller) {
         const sendEvent = (data: object) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
         };

         const fetchRSS = async () => {
            try {
               const response = await fetch(urlRSS, { headers: { "Content-Type": "application/json" } });

               if (!response.ok) throw new Error(`Failed to fetch ${urlRSS}: ${response.status}`);

               const rss = await response.json();
               const feeds = Object.keys(rss);
               const torrents: Torrent[] = [];
               for (let i = 0, n = feeds.length; i < n; ++i) {
                  const feed = feeds[i];
                  const articles = rss[feed].articles;
                  for (let j = 0, m = articles.length; j < m; ++j) {
                     const article = articles[j];
                     if (article.isRead) continue;

                     const title = article.title;
                     const series = getSeries(title);
                     const resolution = getResolution(title);
                     const name = series && resolution && regexDate.test(title)
                        ? title.substring(0, title.indexOf(resolution))
                        : series
                           ? title.substring(0, title.indexOf(series) + series.length)
                           : resolution
                              ? title.substring(0, title.lastIndexOf(resolution))
                              : title;
                     const size = article.contentLength ? formatSize(article.contentLength) : getSize(title);
                     const bytes = article.contentLength ? +article.contentLength : getBytes(size);
                     const torrent: Torrent = {
                        added_on: Math.floor(new Date(article.date).getTime() / 1000),
                        bytes: bytes,
                        category: series ? "TV" : resolution ? "Movie" : "Other",
                        dlspeed: 0,
                        eta: -1,
                        feed: feed,
                        hash: article.torrentURL,
                        id: article.id,
                        is_read: article.isRead,
                        is_series: series != null,
                        name: name.replace(regexWhitespace, " "),
                        progress: 0,
                        ratio: 0,
                        resolution: resolution,
                        series: series,
                        size: size,
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
               // Don't close the stream on fetch error to allow for retries.
            }
         };

         await fetchRSS();
         // Set up polling every 7 minutes in conjunction with the 15 minute refresh cycle in qbittorrent.
         intervalId = setInterval(fetchRSS, 7 * 1000 * 60); // HARD-CODED

         // Handle client disconnect.
         request.signal.addEventListener("abort", () => {
            clearInterval(intervalId);
            controller.close();
         });
      },
      cancel() {
         clearInterval(intervalId);
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
