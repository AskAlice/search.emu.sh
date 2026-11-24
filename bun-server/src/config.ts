/**
 * Server Configuration
 */

import { join } from "node:path";

export const config = {
  port: parseInt(process.env.PORT || "3006"),
  hostname: process.env.HOSTNAME || "0.0.0.0",
  isDevelopment: process.env.NODE_ENV !== "production",
  
  // TLS/HTTP3 configuration
  tls: {
    enabled: process.env.TLS_ENABLED !== "false",
    certFile: process.env.TLS_CERT || join(import.meta.dir, "../certs/cert.pem"),
    keyFile: process.env.TLS_KEY || join(import.meta.dir, "../certs/key.pem"),
  },
  
  // API Keys
  cryptocompareKey: process.env.CRYPTOCOMPARE_KEY || "",
  
  // Cache settings
  cache: {
    ttl: 300, // 5 minutes
  },
  
  // Static files
  staticDir: join(import.meta.dir, "static"),
  iconsDir: join(import.meta.dir, "static/icons"),
  
  // GeoIP database
  geoipDatabase: join(import.meta.dir, "../data/GeoLite2-City.mmdb"),
};
