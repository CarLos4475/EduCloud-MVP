/* Anfitrión de recursos interactivos (paquete versión 2).
   El código generado corre en una página aislada (/sandbox.html): iframe con sandbox="allow-scripts"
   (sin allow-same-origin), de modo que su origen es opaco, y con una política de contenido propia
   que bloquea red, marcos y recursos externos. Aquí solo entran mensajes pequeños y validados. */
import katex from "katex";

export type SandboxPackage = {
  schemaVersion: 2;
  title: string;
  html: string;
  css: string;
  javascript: string;
};

export type SandboxCallbacks = {
  state(value: unknown): void;
  report(text: string): void;
  fail(): void;
  ready(): void;
};

const MAX_MATH_REQUESTS = 600;

export function mountSandbox(
  container: HTMLElement,
  pkg: SandboxPackage,
  state: Record<string, unknown>,
  callbacks: SandboxCallbacks,
): { destroy(): void } {
  const frame = document.createElement("iframe");
  frame.title = pkg.title;
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.className = "sandbox-frame";
  frame.style.height = "260px";
  const loading = document.createElement("div");
  loading.className = "sandbox-loading";
  loading.setAttribute("aria-hidden", "true");
  loading.innerHTML = "<i></i><i></i><i></i>";
  container.replaceChildren(loading, frame);

  let dead = false;
  let loaded = false;
  let mathRequests = 0;
  const timeout = setTimeout(() => {
    if (!loaded) fail();
  }, 12000);

  function fail() {
    if (dead) return;
    dead = true;
    clearTimeout(timeout);
    frame.setAttribute("inert", "");
    callbacks.fail();
  }
  function reply(message: Record<string, unknown>) {
    // El destino real tiene origen opaco: solo se escribe a la ventana que creó este anfitrión.
    frame.contentWindow?.postMessage({ ec: 1, ...message }, "*");
  }

  function onMessage(event: MessageEvent) {
    if (dead || event.source !== frame.contentWindow || event.origin !== "null")
      return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.ec !== 1) return;
    switch (data.t) {
      case "hello":
        void import("./assets").then(({ sandboxCss, sandboxKit }) => {
          if (dead) return;
          reply({
            t: "boot",
            css: `${sandboxCss}\n${pkg.css || ""}`,
            kit: sandboxKit,
            html: pkg.html,
            js: pkg.javascript,
            state,
          });
        });
        break;
      case "ready":
        if (loaded) break;
        loaded = true;
        clearTimeout(timeout);
        loading.remove();
        callbacks.ready();
        break;
      case "size": {
        const height = Number(data.height);
        if (Number.isFinite(height))
          frame.style.height = `${Math.min(2400, Math.max(160, Math.ceil(height)))}px`;
        break;
      }
      case "state":
        try {
          if (JSON.stringify(data.value).length <= 40000)
            callbacks.state(data.value);
        } catch {
          /* estado no serializable */
        }
        break;
      case "report":
        if (typeof data.value === "string")
          callbacks.report(data.value.slice(0, 3000));
        break;
      case "math":
        if (
          typeof data.latex === "string" &&
          Number.isSafeInteger(data.id) &&
          ++mathRequests <= MAX_MATH_REQUESTS
        ) {
          // Salida de una biblioteca de confianza: el HTML recibido nunca viene del recurso.
          const html = katex.renderToString(data.latex.slice(0, 1500), {
            displayMode: data.display === true,
            throwOnError: false,
            trust: false,
            strict: "ignore",
            maxExpand: 1000,
            maxSize: 20,
            output: "htmlAndMathml",
          });
          reply({ t: "math-result", id: data.id, html });
        }
        break;
      case "error":
        fail();
        break;
    }
  }
  window.addEventListener("message", onMessage);
  frame.src = "/sandbox.html";
  return {
    destroy() {
      dead = true;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      frame.remove();
    },
  };
}
