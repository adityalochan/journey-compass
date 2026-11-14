import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Loopback only: nobody on the local network (e.g. eduroam) can reach the dev server directly.
    // The VS Code port-forwarding tunnel is the only way in.
    host: "127.0.0.1",
    port: 5173,
    strictPort: true, // never silently switch ports and break the shared link
    // Only accept requests addressed to localhost or the VS Code dev tunnel.
    allowedHosts: [".devtunnels.ms"],
    // Serve only the site and Tarun's shared data/types. Nothing else in the repo
    // (organizer data in data/raw, .env, .git) can be fetched through the dev server.
    fs: { strict: true, allow: [".", "../src"], deny: [".env", ".env.*", "*.{crt,pem,key}", "**/.git/**"] },
  },
});
