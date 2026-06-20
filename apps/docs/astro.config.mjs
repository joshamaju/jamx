import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "jamx",
      description:
        "Small, composable TypeScript packages for HTTP workflows and structured logging.",
      editLink: {
        baseUrl: "https://github.com/joshamaju/jamx/edit/main/apps/docs/",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/joshamaju/jamx",
        },
      ],
      sidebar: [
        { label: "Overview", slug: "index" },
        {
          label: "@jamx/http",
          items: [
            { label: "Overview", slug: "http" },
            { label: "Quick Start", slug: "http/quick-start" },
            { label: "Interceptors", slug: "http/interceptors" },
            { label: "Decoders", slug: "http/decoders" },
            { label: "API Reference", slug: "http/api" },
          ],
        },
        {
          label: "@jamx/logger",
          items: [
            { label: "Overview", slug: "logger" },
            { label: "Quick Start", slug: "logger/quick-start" },
            { label: "Pipeline", slug: "logger/pipeline" },
            { label: "Processors", slug: "logger/processors" },
            { label: "Transports", slug: "logger/transports" },
            { label: "Examples", slug: "logger/examples" },
            { label: "API Reference", slug: "logger/api" },
          ],
        },
      ],
    }),
  ],
});
