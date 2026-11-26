import { useEffect, useMemo, useState } from "react";
import { studyRows, type Row } from "../../api";
import { Skeleton } from "../../components/Skeleton";
import { ArtImage, Icon } from "../../components/Icons";
import {
  KINDS,
  KIND_ICONS,
  type Kind,
  type ResourceRow,
} from "../resources/types";

/* Biblioteca: todos los recursos de todas las materias en un solo lugar,
   con búsqueda y filtros por tipo y materia. */

type Item = ResourceRow & { subjectName: string };

const ACTIVE = ["queued", "running", "cancel_requested"];
const plain = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Library({
  subjects,
  onOpen,
  onCreate,
}: {
  subjects: Row[];
  onOpen: (subjectId: string, resourceId: string) => void;
  onCreate: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [subjectId, setSubjectId] = useState("all");
  const ids = subjects.map((s) => String(s.id)).join(",");

  useEffect(() => {
    let alive = true;
    setItems(null);
    Promise.all(
      subjects.map((s) =>
        studyRows<ResourceRow>(`/subjects/${s.id}/resources`)
          .then((page) =>
            page.items.map((r) => ({ ...r, subjectName: String(s.name) })),
          )
          .catch(() => [] as Item[]),
      ),
    ).then((groups) => alive && setItems(groups.flat()));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const shown = useMemo(() => {
    const q = plain(query.trim());
    return (items ?? []).filter(
      (r) =>
        (kind === "all" || r.kind === kind) &&
        (subjectId === "all" || r.subjectId === subjectId) &&
        (!q || plain(`${r.title} ${r.subjectName}`).includes(q)),
    );
  }, [items, query, kind, subjectId]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of items ?? []) map.set(r.kind, (map.get(r.kind) ?? 0) + 1);
    return map;
  }, [items]);

  const filtering =
    query.trim() !== "" || kind !== "all" || subjectId !== "all";

  return (
    <section className="library" aria-labelledby="library-title">
      <div className="page-heading">
        <span className="eyebrow">TODO LO QUE HAS PREPARADO</span>
        <h1 id="library-title">Mi biblioteca.</h1>
        <p>Resúmenes, práctica y experimentos de todas tus materias.</p>
      </div>

      <div className="library-tools">
        <label className="library-search">
          <span className="sr-only">Buscar en la biblioteca</span>
          <input
            type="search"
            placeholder="Buscar un recurso…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {subjects.length > 1 && (
          <label className="library-subject">
            <span className="sr-only">Materia</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="all">Todas las materias</option>
              {subjects.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="primary" onClick={onCreate}>
          + Crear un recurso
        </button>
      </div>

      <div className="library-kinds" role="group" aria-label="Tipo de recurso">
        <button
          className={kind === "all" ? "on" : ""}
          aria-pressed={kind === "all"}
          onClick={() => setKind("all")}
        >
          Todos
          {items && <span className="tab-count">{items.length}</span>}
        </button>
        {KINDS.filter((k) => counts.get(k.id)).map((k) => (
          <button
            key={k.id}
            data-kind={k.id}
            className={kind === k.id ? "on" : ""}
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
          >
            {k.label}
            <span className="tab-count">{counts.get(k.id)}</span>
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="resource-grid" role="status" aria-label="Cargando">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="resource-card skeleton-card">
              <Skeleton lines={3} />
            </div>
          ))}
        </div>
      ) : shown.length ? (
        <div className="resource-grid library-grid">
          {shown.map((r) => {
            const meta = KINDS.find((k) => k.id === r.kind);
            const pending = ACTIVE.includes(r.latestStatus ?? "");
            return (
              <button
                key={r.id}
                data-kind={r.kind}
                className="resource-card library-card"
                onClick={() => onOpen(r.subjectId, r.id)}
              >
                <span className="library-card-art" aria-hidden="true">
                  <ArtImage src={`/art/kinds/${r.kind}.png`}>
                    <Icon name={KIND_ICONS[r.kind] ?? "summary"} size={26} />
                  </ArtImage>
                </span>
                <span className="resource-kind">{meta?.label ?? r.kind}</span>
                <strong>{r.title}</strong>
                <small>
                  {r.subjectName} ·{" "}
                  {pending
                    ? "Preparándose…"
                    : r.latestStatus === "failed" && !r.currentVersionId
                      ? "No se pudo crear"
                      : `${r.versionCount} ${r.versionCount === 1 ? "versión" : "versiones"}`}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <ArtImage
            src={filtering ? "/art/empty-search.png" : "/art/empty-library.png"}
            className="empty-art"
          >
            {null}
          </ArtImage>
          <h3>
            {filtering
              ? "No encontramos nada con esos filtros."
              : "Tu biblioteca está vacía."}
          </h3>
          <p>
            {filtering
              ? "Prueba con otra palabra o quita un filtro."
              : "Crea tu primer recurso a partir de tus apuntes y aparecerá aquí."}
          </p>
          {filtering && (
            <button
              className="secondary"
              onClick={() => {
                setQuery("");
                setKind("all");
                setSubjectId("all");
              }}
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}
