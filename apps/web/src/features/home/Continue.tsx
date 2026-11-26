import { useEffect, useState } from "react";
import { api, studyRows, type Row } from "../../api";
import { ArtImage, Icon, type IconName } from "../../components/Icons";
import { KINDS, KIND_ICONS, type ResourceRow } from "../resources/types";

/* «Continúa donde te quedaste»: lo siguiente que conviene hacer, sacado de tus materias.
   Prioriza repasos pendientes, luego el recurso más reciente y, al final, lo que falta preparar. */

type Progress = {
  materialsReady: number;
  resourcesReady: number;
  cardsToReview: number;
  recommendations: { text: string; resourceId?: string | null }[];
};

type Tile = {
  key: string;
  rank: number;
  eyebrow: string;
  title: string;
  detail: string;
  art?: string;
  icon: IconName;
  action: string;
  run: () => void;
};

const MAX_SUBJECTS = 4;
const MAX_TILES = 4;

export function ContinueSection({
  subjects,
  onResource,
  onSubject,
  onCreate,
}: {
  subjects: Row[];
  onResource: (subjectId: string, resourceId: string) => void;
  onSubject: (subjectId: string, tab: "apuntes" | "recursos") => void;
  onCreate: (subjectId: string) => void;
}) {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const ids = subjects
    .slice(0, MAX_SUBJECTS)
    .map((s) => String(s.id))
    .join(",");

  useEffect(() => {
    let alive = true;
    setTiles(null);
    const picked = subjects.slice(0, MAX_SUBJECTS);
    if (!picked.length) {
      setTiles([]);
      return;
    }
    Promise.all(
      picked.map(async (subject) => {
        const subjectId = String(subject.id);
        const name = String(subject.name);
        const [progress, resources] = await Promise.all([
          api<Progress>(`/subjects/${subjectId}/progress`).catch(() => null),
          studyRows<ResourceRow>(`/subjects/${subjectId}/resources`)
            .then((page) => page.items)
            .catch(() => [] as ResourceRow[]),
        ]);
        const made: Tile[] = [];
        const ready = resources.filter(
          (r) =>
            !["queued", "running", "cancel_requested"].includes(
              r.latestStatus ?? "",
            ) && r.currentVersionId,
        );
        const tip = progress?.recommendations?.[0];
        if (progress && progress.cardsToReview > 0) {
          const cards = ready.find((r) => r.kind === "flashcards");
          made.push({
            key: `${subjectId}:review`,
            rank: 0,
            eyebrow: name,
            title:
              progress.cardsToReview === 1
                ? "1 tarjeta te espera"
                : `${progress.cardsToReview} tarjetas te esperan`,
            detail: "Un repaso corto ahora ayuda a que se quede.",
            art: "/art/kinds/flashcards.png",
            icon: KIND_ICONS.flashcards,
            action: "Repasar",
            run: () =>
              cards
                ? onResource(subjectId, cards.id)
                : onSubject(subjectId, "recursos"),
          });
        } else if (tip) {
          made.push({
            key: `${subjectId}:tip`,
            rank: 1,
            eyebrow: name,
            title: tip.text,
            detail: "Sugerencia según tu avance.",
            icon: "bulb",
            action: "Ver",
            run: () =>
              tip.resourceId
                ? onResource(subjectId, tip.resourceId)
                : onSubject(subjectId, "recursos"),
          });
        }
        const latest = ready[0];
        if (latest) {
          const kind = KINDS.find((k) => k.id === latest.kind);
          made.push({
            key: `${subjectId}:latest`,
            rank: 2,
            eyebrow: `${name} · ${kind?.label ?? "Recurso"}`,
            title: latest.title,
            detail: "Retómalo donde lo dejaste.",
            art: `/art/kinds/${latest.kind}.png`,
            icon: KIND_ICONS[latest.kind] ?? "summary",
            action: "Abrir",
            run: () => onResource(subjectId, latest.id),
          });
        }
        if (progress && progress.materialsReady === 0) {
          made.push({
            key: `${subjectId}:notes`,
            rank: 4,
            eyebrow: name,
            title: "Sube tus apuntes",
            detail: "Con ellos puedo prepararte resúmenes y práctica.",
            icon: "summary",
            action: "Subir apuntes",
            run: () => onSubject(subjectId, "apuntes"),
          });
        } else if (progress && !ready.length) {
          made.push({
            key: `${subjectId}:first`,
            rank: 3,
            eyebrow: name,
            title: "Crea tu primer recurso",
            detail: "Tarjetas, cuestionario o un experimento interactivo.",
            icon: "flask",
            action: "Crear",
            run: () => onCreate(subjectId),
          });
        }
        return made;
      }),
    ).then((groups) => {
      if (!alive) return;
      const all = groups.flat().sort((a, b) => a.rank - b.rank);
      // Una sola tarjeta por materia y tipo para no repetir; se muestran las más útiles.
      setTiles(all.slice(0, MAX_TILES));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (!subjects.length) return null;
  if (tiles && !tiles.length) return null;

  return (
    <section className="continue" aria-labelledby="continue-title">
      <div className="section-heading continue-head">
        <div>
          <span className="eyebrow continue-eyebrow">
            <ArtImage
              src="/art/icons/action-continue.png"
              className="action-art"
            >
              {null}
            </ArtImage>
            SIGUE TU RITMO
          </span>
          <h2 id="continue-title">Continúa donde te quedaste</h2>
        </div>
        <ArtImage src="/art/continue-hero.png" className="continue-hero">
          {null}
        </ArtImage>
      </div>
      {tiles === null ? (
        <div className="continue-grid" role="status" aria-label="Cargando">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="continue-tile skeleton-card"
              aria-hidden="true"
            >
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <div className="continue-grid">
          {tiles.map((tile) => (
            <button key={tile.key} className="continue-tile" onClick={tile.run}>
              <span className="continue-art" aria-hidden="true">
                {tile.art ? (
                  <ArtImage src={tile.art}>
                    <Icon name={tile.icon} size={24} />
                  </ArtImage>
                ) : (
                  <Icon name={tile.icon} size={24} />
                )}
              </span>
              <span className="continue-text">
                <span className="eyebrow">{tile.eyebrow}</span>
                <strong>{tile.title}</strong>
                <small>{tile.detail}</small>
              </span>
              <span className="continue-go">{tile.action} →</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
