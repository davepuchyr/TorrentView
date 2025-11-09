import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   const body = await request.json();
   const torrent = body.torrent as Torrent;
   const data = body.data;
   const fileIndices =
      torrent.files
         ?.map((file, index) => (data.selectedFiles.has(file.name) ? index : -1))
         .filter(index => index !== -1)
         .join("|") || "";
   const formData = new FormData();

   formData.append("urls", torrent.hash);
   formData.append("savepath", data.savePath);
   formData.append("paused", String(data.paused));
   formData.append("sequential", String(data.sequential));
   formData.append("firstLastPiecePrio", String(data.firstLastPiecePrio));
   formData.append("root_folder", data.contentLayout === "Original" ? "unset" : String(data.contentLayout === "Subfolder"));
   if (fileIndices) {
      formData.append(
         "file_priority",
         fileIndices
            .split("|")
            .map(() => "1")
            .join("|"),
      ); // Use '1' for normal priority
      const allFileIndices = torrent.files!.map((_, i) => i).join("|");
      const unselectedIndices = allFileIndices
         .split("|")
         .filter(i => !fileIndices.includes(i))
         .join("|");
      if (unselectedIndices) {
         formData.append("file_priority", "0|" + unselectedIndices); // Use '0' to not download
      }
   }

   const url = `${backendUrl}/api/v2/torrents/add`;
   let fetched: Response;

   try {
      fetched = await fetch(url, {
         method: "POST",
         body: formData,
      });

      if (fetched.status == 200) console.log(`Marked ${body.feed}.${body.id} as read.`);
   } catch (e) {
      console.error(`Failed to mark ${body.feed}.${body.id} as read:`, e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }

   return new NextResponse(fetched.body, { status: fetched.status, headers: fetched.headers });
}
