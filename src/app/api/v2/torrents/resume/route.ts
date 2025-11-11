import { NextRequest, NextResponse } from "next/server";
import type { Torrent, TorrentFile } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   throw new Error(
      "This was a work-in-progress that lead to nowhere since autodownloading of RSS torrents has to be disabled in order to prevent a full download of the torrent, which sucks for all the torrents that are automagically downloaded with RSS rules.",
   );
}
