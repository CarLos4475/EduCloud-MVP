import { useEffect, useRef, useState } from "react";
import { api, studyRows, type Row } from "../../api";
import { ArtImage, Icon } from "../../components/Icons";
import {
  KINDS,
  KIND_ICONS,
  type Kind,
  type MaterialLite,
} from "../resources/types";
import { watch } from "../notify/watch";

/* Hoja para crear un recurso desde cualquier parte: tipo, materia y listo.
   Los apuntes listos se usan por defecto y la generación sigue en segundo plano. */

export type CreateDraft = {
  subjectId?: string;
  kind?: Kind;
  instruction?: string;
};

const STYLES = [
  { id: "free", label: "Libre", starter: "" },
  { id: "graph", label: "Gráfica", starter: "Una gráfica que pueda mover: " },
  {
    id: "3d",
    label: "3D (R³)",
    starter: "Una escena 3D en R³ que pueda girar: ",
  },
  {
    id: "network",
    label: "Grafos",
    starter: "Un grafo para recorrer paso a paso: ",
  },
  {
    id: "lesson",
    label: "Lección guiada",
    starter: "Un tutorial paso a paso sobre: ",
  },
  {
    id: "sim",
    label: "Simulación",
    starter: "Una simulación animada de: ",
  },
] as const;

export function CreateSheet({
  subjects,
  draft,
  onClose,
  onCreated,
}: {
  subjects: Row[];
  draft: CreateDraft;
  onClose: () => void;
  onCreated: (created: { resourceId: string; subjectId: string }) => void;
}) {
  const [kind, setKind] = useState<Kind>(draft.kind ?? "flashcards");
  const [subjectId, setSubjectId] = useState(
    draft.subjectId && subjects.some((s) => s.id === draft.subjectId)
      ? draft.subjectId
      : String(subjects[0]?.id ?? ""),
  );
  const [instruction, setInstruction] = useState(draft.instruction ?? "");
  const [style, setStyle] = useState("free");
  const [materials, setMaterials] = useState<MaterialLite[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [general, setGeneral] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Los apuntes listos de la materia elegida quedan marcados por defecto.
  useEffect(() => {
    if (!subjectId) return;
    let alive = true;
    setMaterials(null);
    studyRows<MaterialLite>(`/subjects/${subjectId}/materials`)
      .then((page) => {
        if (!alive) return;
        const ready = page.items.filter((m) =>
          ["ready", "partial"].includes(m.status),
        );
        setMaterials(ready);
        setChosen(ready.slice(0, 10).map((m) => m.id));
      })
      .catch(() => alive && setMaterials([]));
    return () => {
      alive = false;
    };
  }, [subjectId]);

  const noNotes = materials !== null && materials.length === 0;
  const allowGeneral = general || noNotes;

  function pickStyle(id: string) {
    const previous = STYLES.find((s) => s.id === style);
    const next = STYLES.find((s) => s.id === id);
    setStyle(id);
    if (!next) return;
    if (!instruction.trim() || instruction === previous?.starter)
      setInstruction(next.starter);
  }

  async function submit() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<{ id: string; title: string }>("/resources", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          subjectId,
          kind,
          instruction: instruction.trim(),
          materialIds: chosen,
          allowGeneral,
        }),
      });
      watch.track({
        resourceId: created.id,
        subjectId,
        title: created.title,
        kind,
      });
      onCreated({ resourceId: created.id, subjectId });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const subjectName = (id: string) =>
    String(subjects.find((s) => s.id === id)?.name ?? "");

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      >
        <header className="sheet-head">
          <div>
            <span className="eyebrow">CREAR</span>
            <h2 id="sheet-title">¿Qué quieres crear?</h2>
          </div>
          <ArtImage src="/art/create-hero.png" className="sheet-hero">
            {null}
          </ArtImage>
          <button
            type="button"
            className="sheet-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {!subjects.length ? (
          <p className="quiet-panel">
            Primero crea una materia y sube tus apuntes; después puedes crear
            recursos desde aquí.
          </p>
        ) : (
          <>
            <fieldset className="sheet-kinds">
              <legend className="sr-only">Tipo de recurso</legend>
              {KINDS.map((k, index) => (
                <label
                  key={k.id}
                  data-kind={k.id}
                  className={`sheet-kind ${kind === k.id ? "selected" : ""}`}
                >
                  <input
                    ref={index === 0 ? first : undefined}
                    type="radio"
                    name="sheet-kind"
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                  />
                  <span className="sheet-kind-art" aria-hidden="true">
                    <ArtImage src={`/art/kinds/${k.id}.png`}>
                      <Icon name={KIND_ICONS[k.id]} size={26} />
                    </ArtImage>
                  </span>
                  <strong>{k.label}</strong>
                </label>
              ))}
            </fieldset>

            {kind === "interactive" && (
              <div className="sheet-styles" role="group" aria-label="Estilo">
                {STYLES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={style === s.id ? "on" : ""}
                    aria-pressed={style === s.id}
                    onClick={() => pickStyle(s.id)}
                  >
                    <ArtImage src={`/art/kinds/interactive-${s.id}.png`}>
                      <Icon name="flask" size={18} />
                    </ArtImage>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="sheet-row">
              <label>
                Materia
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="sheet-notes" role="status">
                {materials === null
                  ? "Revisando tus apuntes…"
                  : noNotes
                    ? "Sin apuntes listos: usaré conocimiento general."
                    : `${chosen.length} de ${materials.length} apuntes seleccionados`}
              </p>
            </div>

            <label>
              ¿Algo en particular? (opcional)
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Por ejemplo: enfócate en la ley de Ohm"
              />
            </label>

            {materials && materials.length > 0 && (
              <details className="sheet-more">
                <summary>Elegir apuntes y fuentes</summary>
                <div className="sheet-sources">
                  {materials.map((m) => (
                    <label className="check-label" key={m.id}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(m.id)}
                        onChange={(e) =>
                          setChosen((current) =>
                            e.target.checked
                              ? [...current, m.id].slice(0, 10)
                              : current.filter((id) => id !== m.id),
                          )
                        }
                      />
                      {m.name}
                    </label>
                  ))}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={general}
                      onChange={(e) => setGeneral(e.target.checked)}
                    />
                    Puedes complementar con conocimiento general.
                  </label>
                </div>
              </details>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="sheet-foot">
          <small>
            {subjects.length
              ? `${subjectName(subjectId)} · se prepara en segundo plano`
              : ""}
          </small>
          <div className="button-row">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                !subjects.length ||
                materials === null ||
                (!chosen.length && !allowGeneral)
              }
            >
              {busy ? "Creando…" : "Crear"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
