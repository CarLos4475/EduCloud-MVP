import { useEffect, useSyncExternalStore } from "react";
import { Burst, Check } from "../resources/Practice";
import { watch, type Toast } from "./watch";

// Frases completas por tipo: así concuerdan en género y número.
const WORDS: Record<
  string,
  { ready: string; failed: string; pending: string }
> = {
  flashcards: {
    ready: "¡Tus tarjetas están listas!",
    failed: "No se pudieron preparar tus tarjetas",
    pending: "tus tarjetas",
  },
  quiz: {
    ready: "¡Tu cuestionario está listo!",
    failed: "No se pudo preparar tu cuestionario",
    pending: "tu cuestionario",
  },
  exercises: {
    ready: "¡Tus ejercicios están listos!",
    failed: "No se pudieron preparar tus ejercicios",
    pending: "tus ejercicios",
  },
  connections: {
    ready: "¡Tus conexiones están listas!",
    failed: "No se pudieron preparar tus conexiones",
    pending: "tus conexiones",
  },
  interactive: {
    ready: "¡Tu experimento está listo!",
    failed: "No se pudo preparar tu experimento",
    pending: "tu experimento",
  },
  summary: {
    ready: "¡Tu resumen está listo!",
    failed: "No se pudo preparar tu resumen",
    pending: "tu resumen",
  },
  concepts: {
    ready: "¡Tus conceptos clave están listos!",
    failed: "No se pudieron preparar tus conceptos clave",
    pending: "tus conceptos clave",
  },
};
// Si varios recursos terminan a la vez, solo se ven los más recientes para no tapar la pantalla.
const MAX_VISIBLE = 2;
const words = (kind: string) =>
  WORDS[kind] ?? {
    ready: "¡Tu recurso está listo!",
    failed: "No se pudo preparar tu recurso",
    pending: "tu recurso",
  };

function ToastCard({
  toast,
  onOpen,
}: {
  toast: Toast;
  onOpen: (subjectId: string, resourceId: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => watch.dismiss(toast.id), 22000);
    return () => clearTimeout(timer);
  }, [toast.id]);
  const ready = toast.status === "ready";
  return (
    <div className={`toast ${ready ? "ready" : "failed"}`} role="status">
      {ready && <Burst />}
      <span className="toast-icon" aria-hidden="true">
        {ready ? <Check /> : "!"}
      </span>
      <div className="toast-text">
        <strong>
          {ready ? words(toast.kind).ready : words(toast.kind).failed}
        </strong>
        <small>{toast.title}</small>
      </div>
      <button
        className="primary"
        onClick={() => {
          watch.dismiss(toast.id);
          onOpen(toast.subjectId, toast.resourceId);
        }}
      >
        {ready ? "Abrir" : "Ver"}
      </button>
      <button
        className="toast-close"
        aria-label="Cerrar aviso"
        onClick={() => watch.dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

/** Avisos de recursos: una pastilla mientras se preparan y una tarjeta animada al terminar. */
export function ResourceToasts({
  onOpen,
}: {
  onOpen: (subjectId: string, resourceId: string) => void;
}) {
  const state = useSyncExternalStore(watch.subscribe, watch.snapshot);
  const waiting = state.pending.filter((p) => p.resourceId !== state.viewing);
  return (
    <div className="toast-dock" aria-live="polite">
      {waiting.length > 0 && (
        <div className="toast-pending" role="status">
          <span className="toast-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            {waiting.length === 1
              ? `Preparando ${words(waiting[0].kind).pending}…`
              : `Preparando ${waiting.length} recursos…`}
          </span>
        </div>
      )}
      {state.toasts.length > MAX_VISIBLE && (
        <div className="toast-more" role="status">
          {state.toasts.length - MAX_VISIBLE === 1
            ? "Y 1 aviso más"
            : `Y ${state.toasts.length - MAX_VISIBLE} avisos más`}
        </div>
      )}
      {state.toasts.slice(-MAX_VISIBLE).map((toast) => (
        <ToastCard key={toast.id} toast={toast} onOpen={onOpen} />
      ))}
    </div>
  );
}
