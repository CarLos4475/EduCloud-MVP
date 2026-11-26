import { api } from "../../api";
import type { ResourceDetail } from "../resources/types";

/* Observador global de recursos en preparación. Sigue cada trabajo aunque la persona cambie de
   pantalla y deja un aviso cuando termina. Consulta solo mientras haya algo pendiente. */

const ACTIVE = ["queued", "running", "cancel_requested"];
const POLL_MS = 4000;
const STORAGE = "campus.watch.v1";

export type Tracked = {
  resourceId: string;
  subjectId: string;
  title: string;
  kind: string;
};
export type Toast = Tracked & { id: string; status: "ready" | "failed" };
type State = { pending: Tracked[]; toasts: Toast[]; viewing: string | null };

function restore(): Tracked[] {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.slice(0, 20) : [];
  } catch {
    return [];
  }
}

let state: State = { pending: restore(), toasts: [], viewing: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let original = "";

function persist() {
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(state.pending));
  } catch {
    /* sin almacenamiento: los avisos siguen funcionando mientras la pestaña viva */
  }
}

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  persist();
  listeners.forEach((listener) => listener());
  schedule();
}

function schedule() {
  if (timer || !state.pending.length) return;
  timer = setTimeout(() => void poll(), POLL_MS);
}

function announceInTab(label: string) {
  if (typeof document === "undefined" || !document.hidden) return;
  original = original || document.title;
  document.title = `● ${label} · ${original}`;
}
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && original) {
      document.title = original;
      original = "";
    }
  });

async function poll() {
  timer = undefined;
  const finished: {
    item: Tracked;
    status: "ready" | "failed";
    title: string;
  }[] = [];
  for (const item of [...state.pending]) {
    try {
      const detail = await api<ResourceDetail>(`/resources/${item.resourceId}`);
      const last = detail.versions[detail.versions.length - 1];
      if (last && !ACTIVE.includes(last.status))
        finished.push({
          item,
          status: last.status === "succeeded" ? "ready" : "failed",
          title: detail.title,
        });
    } catch {
      /* un fallo de red puntual no cancela el seguimiento */
    }
  }
  if (finished.length) {
    const done = new Set(finished.map((f) => f.item.resourceId));
    const toasts = finished
      // Si ya está viéndolo, la propia pantalla del recurso lo muestra.
      .filter((f) => f.item.resourceId !== state.viewing)
      .map((f) => ({
        ...f.item,
        title: f.title,
        id: `${f.item.resourceId}:${Date.now()}`,
        status: f.status,
      }));
    if (toasts.length)
      announceInTab(
        toasts[0].status === "ready" ? "Listo" : "Revisa tu recurso",
      );
    emit({
      pending: state.pending.filter((p) => !done.has(p.resourceId)),
      toasts: [...state.toasts, ...toasts].slice(-4),
    });
  } else schedule();
}

export const watch = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    schedule();
    return () => listeners.delete(listener);
  },
  snapshot: () => state,
  track(item: Tracked) {
    if (state.pending.some((p) => p.resourceId === item.resourceId)) return;
    emit({ pending: [...state.pending, item] });
  },
  dismiss(id: string) {
    emit({ toasts: state.toasts.filter((t) => t.id !== id) });
  },
  setViewing(resourceId: string | null) {
    state = { ...state, viewing: resourceId };
    listeners.forEach((listener) => listener());
  },
  reset() {
    clearTimeout(timer);
    timer = undefined;
    state = { pending: [], toasts: [], viewing: null };
    persist();
    listeners.forEach((listener) => listener());
  },
};
