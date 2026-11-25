import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid ID", { status: 400 });
  }

  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video || !video.storedPath) {
    return new Response("Not found", { status: 404 });
  }

  const safeFile = path.basename(video.storedPath);
  const fullPath = path.join(process.cwd(), "uploads", safeFile);
  if (!safeFile || !fs.existsSync(fullPath)) {
    return new Response("Not found", { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;
  const contentType = video.mimeType || "video/mp4";
  const range = req.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new Response("Invalid Range", { status: 416 });
    }
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;
    if (start >= fileSize || end < start) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(fullPath, { start, end });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(Readable.toWeb(stream) as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = fs.createReadStream(fullPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Response(Readable.toWeb(stream) as any, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
    },
  });
}
