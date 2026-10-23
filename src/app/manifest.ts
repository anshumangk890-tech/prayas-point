import { MetadataRoute } from "next";
import { APP_NAME, APP_NAME_HI, APP_SUBTITLE_HI } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} (${APP_NAME_HI})`,
    short_name: APP_NAME,
    description: APP_SUBTITLE_HI,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#D32F2F",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}