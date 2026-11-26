import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

export default defineConfig(({ mode }) => ({
  envDir: "../..",
  define:
    mode === "mvp"
      ? { "import.meta.env.VITE_EDUCLOUD_MVP": JSON.stringify("true") }
      : {},
  server: {
    fs: {
      deny: [
        "**/.env*",
        "**/*.{crt,pem,key,p12,pfx}",
        "**/.git/**",
        "**/.data/**",
        "**/.superpowers/**",
        "**/.tools/**",
        "**/.codex/**",
        "**/.agents/**",
        "**/.aws/**",
        "**/.gcloud/**",
        "**/credentials.json",
        "**/*firebase-adminsdk*.json",
        "**/service-account*.json",
      ],
    },
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  },
  build: {
    rollupOptions: {
      input:
        mode === "mvp"
          ? { app: "index.html" }
          : { app: "index.html", laboratorio: "h0.html" },
    },
  },
  plugins:
    mode === "mvp"
      ? [
          {
            name: "educloud-mvp",
            transformIndexHtml: (html) =>
              html.replace(
                "<title>Mi Campus</title>",
                "<title>EduCloud</title>",
              ),
            async configureServer(server) {
              const { createTutorHandler } = await import("./api/tutor.mjs");
              const env = loadEnv(
                "mvp",
                fileURLToPath(new URL("../..", import.meta.url)),
                "DEEPSEEK_",
              );
              const tutor = createTutorHandler({
                enabled: true,
                key: env.DEEPSEEK_API_KEY,
              });
              server.middlewares.use("/api/tutor", async (req, res) => {
                try {
                  const headers = new Headers();
                  for (const [name, values] of Object.entries(req.headers))
                    for (const value of Array.isArray(values)
                      ? values
                      : [values])
                      if (value !== undefined) headers.append(name, value);
                  const request = new Request(
                    "http://" + req.headers.host + "/api/tutor",
                    {
                      method: req.method,
                      headers,
                      ...(req.method === "POST"
                        ? { body: Readable.toWeb(req), duplex: "half" }
                        : {}),
                    },
                  );
                  const response = await tutor(request);
                  res.writeHead(
                    response.status,
                    Object.fromEntries(response.headers.entries()),
                  );
                  res.end(await response.text());
                } catch {
                  res.writeHead(400, {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                  });
                  res.end(
                    JSON.stringify({ message: "No se pudo leer la pregunta." }),
                  );
                }
              });
            },
          },
        ]
      : [],
}));
