import { useEffect, useMemo, useRef, useState } from "react";
import { studyRows, type Row } from "../../api";
import { Icon, type IconName } from "../../components/Icons";
import {
  KINDS,
  KIND_ICONS,
  type Kind,
  type ResourceRow,
} from "../resources/types";

/* Paleta Ctrl+K: ir a cualquier parte, crear algo o abrir un recurso escribiendo. */

type Item = {
  id: string;
  group: "Crear" | "Ir a" | "Materias" | "Recursos";
  label: string;
  hint?: string;
  icon: IconName;
  words: string;
  run: () => void;
};

const plain = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function CommandPalette({
  subjects,
  onClose,
  onGo,
  onSubject,
  onCreate,
  onTutor,
  onResource,
}: {
  subjects: Row[];
  onClose: () => void;
  onGo: (nav: string) => void;
  onSubject: (subjectId: string) => void;
  onCreate: (kind?: Kind) => void;
  onTutor: () => void;
  onResource: (subjectId: string, resourceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [resources, setResources] = useState<
    (ResourceRow & { subjectName: string })[]
  >([]);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      subjects.map((s) =>
        studyRows<ResourceRow>(`/subjects/${s.id}/resources`)
          .then((page) =>
            page.items.map((r) => ({ ...r, subjectName: String(s.name) })),
          )
          .catch(() => []),
      ),
    ).then((groups) => alive && setResources(groups.flat()));
    return () => {
      alive = false;
    };
  }, [subjects]);

  const items = useMemo<Item[]>(() => {
    const done = (fn: () => void) => () => {
      onClose();
      fn();
    };
    const all: Item[] = [
      ...KINDS.map((k) => ({
        id: `create-${k.id}`,
        group: "Crear" as const,
        label: `Crear ${k.label.toLowerCase()}`,
        hint: k.hint,
        icon: KIND_ICONS[k.id],
        words: `crear nuevo ${k.label} ${k.id}`,
        run: done(() => onCreate(k.id)),
      })),
      ...(
        [
          ["home", "Inicio", "home"],
          ["subjects", "Materias", "book"],
          ["library", "Biblioteca", "book"],
          ["agenda", "Calendario: pendientes", "calendar"],
          ["schedule", "Calendario: horario", "clock"],
          ["profile", "Mi perfil y pasaporte", "user"],
        ] as const
      ).map(([nav, label, icon]) => ({
        id: `go-${nav}`,
        group: "Ir a" as const,
        label,
        icon: icon as IconName,
        words: `ir abrir ${label} ${nav === "agenda" ? "agenda tareas examenes" : nav === "schedule" ? "horario clases semana" : nav === "library" ? "biblioteca recursos todos" : ""}`,
        run: done(() => onGo(nav)),
      })),
      {
        id: "tutor",
        group: "Ir a" as const,
        label: "Preguntar al tutor",
        icon: "chat" as IconName,
        words: "tutor preguntar ayuda dudas chat",
        run: done(onTutor),
      },
      ...subjects.map((s) => ({
        id: `subject-${s.id}`,
        group: "Materias" as const,
        label: String(s.name),
        hint: "Abrir materia",
        icon: "book" as IconName,
        words: `materia ${s.name}`,
        run: done(() => onSubject(String(s.id))),
      })),
      ...resources.map((r) => ({
        id: `resource-${r.id}`,
        group: "Recursos" as const,
        label: r.title,
        hint: `${KINDS.find((k) => k.id === r.kind)?.label ?? ""} · ${r.subjectName}`,
        icon: KIND_ICONS[r.kind] ?? "file",
        words: `${r.title} ${r.kind} ${r.subjectName} recurso`,
        run: done(() => onResource(r.subjectId, r.id)),
      })),
    ];
    const tokens = plain(query).split(/\s+/).filter(Boolean);
    if (!tokens.length)
      return all.filter((i) => i.group === "Crear" || i.group === "Ir a");
    return all
      .filter((i) => {
        const text = plain(`${i.label} ${i.words} ${i.hint ?? ""}`);
        return tokens.every((t) => text.includes(t));
      })
      .slice(0, 14);
  }, [
    query,
    subjects,
    resources,
    onClose,
    onCreate,
    onGo,
    onSubject,
    onTutor,
    onResource,
  ]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div
      className="sheet-backdrop palette-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar o ir a"
        onKeyDown={onKey}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una materia o un recurso, o escribe «crear»…"
          aria-label="Buscar o ir a"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={
            items[active] ? `pal-${items[active].id}` : undefined
          }
        />
        <ul id="palette-list" role="listbox" ref={list}>
          {items.map((item, index) => {
            const header = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header && <span className="palette-group">{item.group}</span>}
                <button
                  id={`pal-${item.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "active" : ""}
                  onMouseEnter={() => setActive(index)}
                  onClick={item.run}
                >
                  <span className="palette-icon" aria-hidden="true">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="palette-text">
                    <strong>{item.label}</strong>
                    {item.hint && <small>{item.hint}</small>}
                  </span>
                </button>
              </li>
            );
          })}
          {!items.length && (
            <li className="palette-empty">
              No encontré eso. Prueba con otra palabra.
            </li>
          )}
        </ul>
        <footer>
          <span>↑↓ moverse</span>
          <span>Enter elegir</span>
          <span>Esc cerrar</span>
        </footer>
      </div>
    </div>
  );
}
