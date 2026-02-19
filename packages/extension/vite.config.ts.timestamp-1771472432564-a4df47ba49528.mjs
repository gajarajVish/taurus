// vite.config.ts
import { defineConfig } from "file:///Users/vg/PolyOverlay/node_modules/vite/dist/node/index.js";
import react from "file:///Users/vg/PolyOverlay/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///Users/vg/PolyOverlay/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.json
var manifest_default = {
  manifest_version: 3,
  name: "PolyOverlay",
  version: "0.1.0",
  description: "Polymarket overlay for X.com",
  permissions: [
    "storage",
    "activeTab",
    "tabs",
    "sidePanel",
    "scripting"
  ],
  host_permissions: [
    "https://x.com/*",
    "https://twitter.com/*",
    "http://localhost:3000/*"
  ],
  action: {
    default_title: "PolyOverlay",
    default_popup: "src/popup/index.html"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  content_scripts: [
    {
      matches: [
        "https://x.com/*",
        "https://twitter.com/*"
      ],
      js: [
        "src/content/index.tsx"
      ],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    {
      resources: [
        "assets/*"
      ],
      matches: [
        "https://x.com/*",
        "https://twitter.com/*"
      ]
    }
  ]
};

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest_default })
  ],
  build: {
    outDir: "dist",
    emptyDirFirst: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92Zy9Qb2x5T3ZlcmxheS9wYWNrYWdlcy9leHRlbnNpb25cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92Zy9Qb2x5T3ZlcmxheS9wYWNrYWdlcy9leHRlbnNpb24vdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZnL1BvbHlPdmVybGF5L3BhY2thZ2VzL2V4dGVuc2lvbi92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGNyeCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5pbXBvcnQgbWFuaWZlc3QgZnJvbSAnLi9tYW5pZmVzdC5qc29uJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgY3J4KHsgbWFuaWZlc3QgfSksXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgZW1wdHlEaXJGaXJzdDogdHJ1ZSxcbiAgfSxcbn0pO1xuIiwgIntcbiAgXCJtYW5pZmVzdF92ZXJzaW9uXCI6IDMsXG4gIFwibmFtZVwiOiBcIlBvbHlPdmVybGF5XCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMS4wXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJQb2x5bWFya2V0IG92ZXJsYXkgZm9yIFguY29tXCIsXG4gIFwicGVybWlzc2lvbnNcIjogW1xuICAgIFwic3RvcmFnZVwiLFxuICAgIFwiYWN0aXZlVGFiXCIsXG4gICAgXCJ0YWJzXCIsXG4gICAgXCJzaWRlUGFuZWxcIixcbiAgICBcInNjcmlwdGluZ1wiXG4gIF0sXG4gIFwiaG9zdF9wZXJtaXNzaW9uc1wiOiBbXG4gICAgXCJodHRwczovL3guY29tLypcIixcbiAgICBcImh0dHBzOi8vdHdpdHRlci5jb20vKlwiLFxuICAgIFwiaHR0cDovL2xvY2FsaG9zdDozMDAwLypcIlxuICBdLFxuICBcImFjdGlvblwiOiB7XG4gICAgXCJkZWZhdWx0X3RpdGxlXCI6IFwiUG9seU92ZXJsYXlcIixcbiAgICBcImRlZmF1bHRfcG9wdXBcIjogXCJzcmMvcG9wdXAvaW5kZXguaHRtbFwiXG4gIH0sXG4gIFwiYmFja2dyb3VuZFwiOiB7XG4gICAgXCJzZXJ2aWNlX3dvcmtlclwiOiBcInNyYy9iYWNrZ3JvdW5kL2luZGV4LnRzXCIsXG4gICAgXCJ0eXBlXCI6IFwibW9kdWxlXCJcbiAgfSxcbiAgXCJzaWRlX3BhbmVsXCI6IHtcbiAgICBcImRlZmF1bHRfcGF0aFwiOiBcInNyYy9zaWRlcGFuZWwvaW5kZXguaHRtbFwiXG4gIH0sXG4gIFwiY29udGVudF9zY3JpcHRzXCI6IFtcbiAgICB7XG4gICAgICBcIm1hdGNoZXNcIjogW1xuICAgICAgICBcImh0dHBzOi8veC5jb20vKlwiLFxuICAgICAgICBcImh0dHBzOi8vdHdpdHRlci5jb20vKlwiXG4gICAgICBdLFxuICAgICAgXCJqc1wiOiBbXG4gICAgICAgIFwic3JjL2NvbnRlbnQvaW5kZXgudHN4XCJcbiAgICAgIF0sXG4gICAgICBcInJ1bl9hdFwiOiBcImRvY3VtZW50X2lkbGVcIlxuICAgIH1cbiAgXSxcbiAgXCJ3ZWJfYWNjZXNzaWJsZV9yZXNvdXJjZXNcIjogW1xuICAgIHtcbiAgICAgIFwicmVzb3VyY2VzXCI6IFtcbiAgICAgICAgXCJhc3NldHMvKlwiXG4gICAgICBdLFxuICAgICAgXCJtYXRjaGVzXCI6IFtcbiAgICAgICAgXCJodHRwczovL3guY29tLypcIixcbiAgICAgICAgXCJodHRwczovL3R3aXR0ZXIuY29tLypcIlxuICAgICAgXVxuICAgIH1cbiAgXVxufSJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFMsU0FBUyxvQkFBb0I7QUFDdlUsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsV0FBVzs7O0FDRnBCO0FBQUEsRUFDRSxrQkFBb0I7QUFBQSxFQUNwQixNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxhQUFlO0FBQUEsRUFDZixhQUFlO0FBQUEsSUFDYjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxrQkFBb0I7QUFBQSxJQUNsQjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBVTtBQUFBLElBQ1IsZUFBaUI7QUFBQSxJQUNqQixlQUFpQjtBQUFBLEVBQ25CO0FBQUEsRUFDQSxZQUFjO0FBQUEsSUFDWixnQkFBa0I7QUFBQSxJQUNsQixNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsWUFBYztBQUFBLElBQ1osY0FBZ0I7QUFBQSxFQUNsQjtBQUFBLEVBQ0EsaUJBQW1CO0FBQUEsSUFDakI7QUFBQSxNQUNFLFNBQVc7QUFBQSxRQUNUO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQU07QUFBQSxRQUNKO0FBQUEsTUFDRjtBQUFBLE1BQ0EsUUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBQUEsRUFDQSwwQkFBNEI7QUFBQSxJQUMxQjtBQUFBLE1BQ0UsV0FBYTtBQUFBLFFBQ1g7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFXO0FBQUEsUUFDVDtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FEOUNBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLElBQUksRUFBRSwyQkFBUyxDQUFDO0FBQUEsRUFDbEI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxFQUNqQjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
