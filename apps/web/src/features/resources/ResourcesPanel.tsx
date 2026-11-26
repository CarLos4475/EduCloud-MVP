import { useCallback, useEffect, useRef, useState } from "react";
import { api, studyRows } from "../../api";
import { Skeleton } from "../../components/Skeleton";
import { ProgressPanel } from "../progress/ProgressPanel";
import { ResourceViewer } from "./ResourceViewer";
import type { ResourceDetail, ResourceRow } from "./types";
import { KINDS } from "./types";
import { ArtImage } from "../../components/Icons";
import { localWorkspace } from "../../mvp/workspace";

const ACTIVE = ["queued", "running", "cancel_requested"];

/* Lista y visor de recursos de una materia. Qué recurso está abierto lo decide la dirección
   de la página (resourceId); crear se hace desde la hoja global de «Crear». */
export function ResourcesPanel({
  subjectId,
  resourceId,
  onResourceChange,
  onCreate,
}: {
  subjectId: string;
  resourceId: string | null;
  onResourceChange: (id: string | null) => void;
  onCreate: () => void;
}) {
  const [rows, setRows] = useState<ResourceRow[] | null>(null);
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const top = useRef<HTMLElement>(null);
  const detailId = detail?.id;
  // Sitúa el recurso o el progreso del MVP al inicio de la vista.
  useEffect(() => {
    if (!detailId && !localWorkspace) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.current?.scrollIntoView({
      behavior: calm ? "auto" : "smooth",
      block: "start",
    });
  }, [detailId]);

  const loadList = useCallback(async () => {
    try {
      const page = await studyRows<ResourceRow>(
        `/subjects/${subjectId}/resources`,
      );
      setRows(page.items);
    } catch (e) {
      setError((e as Error).message);
      setRows((current) => current ?? []);
    }
  }, [subjectId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const open = useCallback(async (id: string) => {
    setOpening(true);
    setError("");
    try {
      setDetail(await api<ResourceDetail>(`/resources/${id}`));
    } catch (e) {
      setError((e as Error).message);
      onResourceChange(null);
    } finally {
      setOpening(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // La dirección manda: abrir o cerrar el recurso sigue a resourceId.
  useEffect(() => {
    if (!resourceId) {
      if (detail) {
        setDetail(null);
        void loadList();
      }
      return;
    }
    if (detail?.id !== resourceId) void open(resourceId);
  }, [resourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la lista cambió por fuera (por ejemplo, un recurso recién creado), se actualiza.
  useEffect(() => {
    if (!resourceId) void loadList();
  }, [resourceId, loadList]);

  // While something is being prepared, check back until it is ready.
  const latest = detail?.versions[detail.versions.length - 1];
  const waiting = Boolean(latest && ACTIVE.includes(latest.status));
  useEffect(() => {
    if (!detail || !waiting) return;
    const timer = setTimeout(() => {
      api<ResourceDetail>(`/resources/${detail.id}`)
        .then((next) => {
          setDetail(next);
          if (!ACTIVE.includes(next.latestStatus ?? "")) void loadList();
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearTimeout(timer);
  }, [detail, waiting, loadList]);

  if (detail)
    return (
      <section
        className="resources-panel"
        aria-label="Recurso de estudio"
        ref={top}
      >
        <button className="text-button" onClick={() => onResourceChange(null)}>
          ← Volver a mis recursos
        </button>
        <ResourceViewer
          detail={detail}
          onChange={setDetail}
          onRefreshList={() => void loadList()}
          onClose={() => onResourceChange(null)}
        />
      </section>
    );

  if (localWorkspace && resourceId && !detail)
    return <Skeleton lines={5} label="Abriendo tu práctica…" />;

  return (
    <section
      className="resources-panel"
      aria-labelledby="resources-title"
      ref={top}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">ESTUDIA A TU MANERA</span>
          <h2 id="resources-title">Recursos para estudiar</h2>
        </div>
        {!localWorkspace && (
          <button className="primary" onClick={onCreate}>
            + Crear un recurso
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ProgressPanel
        subjectId={subjectId}
        onOpen={(id) => onResourceChange(id)}
      />
      {rows === null ? (
        <div className="resource-grid" role="status" aria-label="Cargando">
          {[0, 1, 2].map((i) => (
            <div key={i} className="resource-card skeleton-card">
              <Skeleton lines={3} />
            </div>
          ))}
        </div>
      ) : rows.length ? (
        <div className="resource-grid">
          {rows.map((r) => {
            const meta = KINDS.find((k) => k.id === r.kind);
            const pending = ACTIVE.includes(r.latestStatus ?? "");
            return (
              <button
                key={r.id}
                data-kind={r.kind}
                className="resource-card"
                disabled={opening}
                onClick={() => onResourceChange(r.id)}
              >
                <span className="resource-kind">{meta?.label ?? r.kind}</span>
                <strong>{r.title}</strong>
                <small>
                  {pending
                    ? "Preparándose…"
                    : r.latestStatus === "failed"
                      ? r.currentVersionId
                        ? "Última versión sin completar"
                        : "No se pudo crear"
                      : `${r.versionCount} ${r.versionCount === 1 ? "versión" : "versiones"}`}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <ArtImage src="/art/empty-resources.png" className="empty-art">
            {null}
          </ArtImage>
          <h3>Todavía no tienes recursos.</h3>
          <p>
            {localWorkspace
              ? "Aquí aparecerán los materiales de práctica de esta materia."
              : "Crea un resumen, tarjetas o un cuestionario a partir de tus apuntes."}
          </p>
        </div>
      )}
    </section>
  );
}
