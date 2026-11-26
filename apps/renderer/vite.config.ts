import { defineConfig, type Plugin } from "vite";

const ANCESTORS = "http://127.0.0.1:5173 http://localhost:5173";
// Página principal del laboratorio: solo código propio (y la VM WASM de los recursos antiguos).
const SHELL_CSP = `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' ws://127.0.0.1:5174; worker-src 'self' blob:; img-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${ANCESTORS}`;
// Sandbox del código generado: sin red, sin marcos, sin recursos externos. Solo ejecuta lo que
// el anfitrión le entrega; sus tipografías e imágenes viajan como datos.
const SANDBOX_CSP = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' ${ANCESTORS}`;

function securityHeaders(): Plugin {
  const apply = (
    req: { url?: string },
    res: { setHeader(k: string, v: string): void },
  ) => {
    const sandbox = (req.url ?? "").split("?")[0] === "/sandbox.html";
    res.setHeader("Content-Security-Policy", sandbox ? SANDBOX_CSP : SHELL_CSP);
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (sandbox)
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()",
      );
  };
  return {
    name: "campus-security-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        apply(req, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        apply(req, res);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [securityHeaders()],
  worker: { format: "es" },
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
  },
});
