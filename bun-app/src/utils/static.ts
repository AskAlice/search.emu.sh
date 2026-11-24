/**
 * Static File Server Utility
 * 
 * Uses Bun.file() for zero-copy file serving
 */

import { join } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

/**
 * Serve a static file
 */
export async function serveStatic(path: string, baseDir: string): Promise<Response> {
  // Security: prevent directory traversal
  const normalizedPath = path.replace(/\.\./g, "").replace(/\/+/g, "/");
  const filePath = join(baseDir, normalizedPath);
  
  // Use Bun.file() for efficient file serving
  const file = Bun.file(filePath);
  
  if (await file.exists()) {
    const ext = filePath.substring(filePath.lastIndexOf("."));
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // 1 day cache
      },
    });
  }
  
  return Response.json(
    { error: "File not found", path: normalizedPath },
    { status: 404 }
  );
}
