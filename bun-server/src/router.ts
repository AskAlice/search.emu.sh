/**
 * Main Router - Route requests to appropriate handlers
 */

import { join } from "node:path";
import { config } from "./config";

// Import route handlers
import { handleRoot, handleOsd } from "./routes/root";
import { handleSearch } from "./routes/search";
import { handleSuggest } from "./routes/suggest";
import { handleExample } from "./routes/example";
import { handleTest } from "./routes/test";

// Static file MIME types
const mimeTypes: Record<string, string> = {
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
  ".xml": "application/xml",
};

/**
 * Main router function
 */
export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  
  // Parse query parameters
  const query = Object.fromEntries(url.searchParams);
  
  // Create request context
  const ctx = {
    request,
    url,
    path,
    method,
    query,
    params: {} as Record<string, string>,
  };
  
  // Route matching
  if (method === "GET") {
    // Root route
    if (path === "/") {
      return handleRoot(ctx);
    }
    
    // OpenSearch description
    if (path === "/osd.xml" || path === "/opensearch.xml") {
      return handleOsd(ctx);
    }
    
    // Search route
    if (path === "/search") {
      return handleSearch(ctx);
    }
    
    // Suggest route
    if (path === "/suggest") {
      return handleSuggest(ctx);
    }
    
    // Example route
    if (path === "/example" || path === "/example/") {
      return handleExample(ctx);
    }
    
    // Test route
    if (path === "/test") {
      return handleTest(ctx);
    }
    
    // Static files - icons
    if (path.startsWith("/icons/")) {
      return serveStaticFile(path, config.iconsDir);
    }
    
    // Health check
    if (path === "/health") {
      return new Response(JSON.stringify({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        pid: process.pid,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  
  // 404 Not Found
  return new Response(JSON.stringify({
    message: `Route ${method}:${path} not found`,
    error: "Not Found",
    statusCode: 404,
  }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Serve static files
 */
async function serveStaticFile(path: string, baseDir: string): Promise<Response> {
  const fileName = path.split("/").pop() || "";
  const filePath = join(baseDir, fileName);
  const file = Bun.file(filePath);
  
  if (await file.exists()) {
    const ext = fileName.substring(fileName.lastIndexOf("."));
    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
  
  return new Response("File not found", { status: 404 });
}

// Export request context type
export interface RequestContext {
  request: Request;
  url: URL;
  path: string;
  method: string;
  query: Record<string, string>;
  params: Record<string, string>;
}
