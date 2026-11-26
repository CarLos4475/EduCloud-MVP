import { FormEvent, lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  User,
  reload,
  sendEmailVerification,
} from "firebase/auth";
import { allRows, api, auth, isEmulator, Row } from "./api";
import {
  closeLocalSession,
  hasLocalSession,
  localWorkspace,
  observeLocalSession,
  type LocalSession,
} from "./mvp/workspace";
import { exampleQuizId, subjectId as exampleSubjectId } from "./mvp/fixtures";
import { Login } from "./features/auth/Login";
import { Editor, EditorState } from "./features/academic/Editor";
import { Illustration } from "./components/Illustration";
import { MaterialsPanel } from "./features/materials/MaterialsPanel";
import { PageSkeleton, Skeleton } from "./components/Skeleton";
import { ArtImage, Icon, type IconName } from "./components/Icons";
import { DataPanel } from "./features/account/DataPanel";
import {
  PassportPanel,
  PassportSummary,
} from "./features/progress/PassportPanel";
import { ResourcesPanel } from "./features/resources/ResourcesPanel";
import { ResourceToasts } from "./features/notify/ResourceToasts";
import { CreateSheet, type CreateDraft } from "./features/create/CreateSheet";
import { CommandPalette } from "./features/create/CommandPalette";
import { ContinueSection } from "./features/home/Continue";
import { Library } from "./features/library/Library";
import type { Kind } from "./features/resources/types";
import { watch } from "./features/notify/watch";
const TutorPanel = lazy(() =>
  import("./features/tutor/TutorPanel").then((module) => ({
    default: module.TutorPanel,
  })),
);
import "./styles/study.css";

type Data = Record<string, Row[]>;
const empty = (): Data => ({
  subjects: [],
  periods: [],
  topics: [],
  agenda: [],
  schedule: [],
});
const weekdays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

/* Direcciones reales: Atrás, recargar y compartir enlaces funcionan. */
const TABS = [
  {
    id: "resumen",
    label: "Resumen",
    path: "",
    art: "summary",
    icon: "compass",
  },
  {
    id: "apuntes",
    label: "Apuntes",
    path: "apuntes",
    art: "notes",
    icon: "file",
  },
  {
    id: "recursos",
    label: "Recursos",
    path: "recursos",
    art: "resources",
    icon: "flask",
  },
  {
    id: "pendientes",
    label: "Pendientes",
    path: "pendientes",
    art: "pending",
    icon: "check",
  },
] as const;
type Tab = (typeof TABS)[number]["id"];
type Route = {
  nav: string;
  selected: string | null;
  tab: Tab;
  resource: string | null;
};
const NAV_PATHS: Record<string, string> = {
  home: "/",
  subjects: "/materias",
  library: "/biblioteca",
  agenda: "/calendario",
  schedule: "/calendario/horario",
  profile: "/perfil",
};
function parsePath(pathname: string): Route {
  const [first, id, section, resource] = pathname.split("/").filter(Boolean);
  const tab: Tab =
    TABS.find((t) => t.path && t.path === section)?.id ?? "resumen";
  // Agenda y horario viven juntos en «Calendario»; las direcciones viejas siguen funcionando.
  const nav =
    first === "calendario"
      ? id === "horario"
        ? "schedule"
        : "agenda"
      : first === "horario"
        ? "schedule"
        : first === "agenda"
          ? "agenda"
          : (Object.keys(NAV_PATHS).find(
              (key) => NAV_PATHS[key] === `/${first}`,
            ) ?? "home");
  if (nav !== "subjects")
    return { nav, selected: null, tab: "resumen", resource: null };
  return {
    nav,
    selected: id ?? null,
    tab: id ? tab : "resumen",
    resource: id && section === "recursos" ? (resource ?? null) : null,
  };
}
function buildPath(
  nav: string,
  selected: string | null,
  tab: Tab,
  resource: string | null,
) {
  const base = NAV_PATHS[nav] ?? "/";
  if (nav !== "subjects" || !selected) return base;
  if (resource) return `${base}/${selected}/recursos/${resource}`;
  const part = TABS.find((t) => t.id === tab)?.path;
  return part ? `${base}/${selected}/${part}` : `${base}/${selected}`;
}

export function App() {
  const [user, setUser] = useState<User | LocalSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Data>(empty);
  const [profile, setProfile] = useState<Row | null>(null);
  const [start] = useState(() => parsePath(window.location.pathname));
  const [nav, setNav] = useState(start.nav);
  const [selected, setSelected] = useState<string | null>(start.selected);
  const [tab, setTab] = useState<Tab>(start.tab);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [tutor, setTutor] = useState(false);
  const [openResource, setOpenResource] = useState<string | null>(
    start.resource,
  );
  const [palette, setPalette] = useState(false);
  const [sheet, setSheet] = useState<CreateDraft | null>(null);
  const session = useRef(0);

  useEffect(() => {
    function onSession(value: User | LocalSession | null) {
        session.current++;
        setData(empty());
        setProfile(null);
        setUser(value);
        setInitializing(false);
        setVerified(value && "local" in value ? true : Boolean(value?.emailVerified) || isEmulator);
        // Al recargar con la misma sesión se conserva el lugar; al salir se vuelve al inicio.
        const route = parsePath(value ? window.location.pathname : "/");
        setSelected(route.selected);
        setTab(route.tab);
        setEditor(null);
        setTutor(false);
        setPalette(false);
        setSheet(null);
        watch.reset();
        setNav(route.nav);
        setOpenResource(route.resource);
        if (!value && window.location.pathname !== "/")
          window.history.replaceState({}, "", "/");
        setError("");
    }
    return localWorkspace
      ? observeLocalSession(onSession)
      : onAuthStateChanged(auth, onSession);
  }, []);

  function leaveWorkspace() {
    if (localWorkspace) closeLocalSession();
    else void signOut(auth);
  }

  // La dirección sigue a la pantalla; Atrás y Adelante hacen el camino inverso.
  useEffect(() => {
    if (!user) return;
    const path = buildPath(nav, selected, tab, openResource);
    if (path !== window.location.pathname)
      window.history.pushState({}, "", path);
  }, [user, nav, selected, tab, openResource]);
  useEffect(() => {
    const onPop = () => {
      const route = parsePath(window.location.pathname);
      setNav(route.nav);
      setSelected(route.selected);
      setTab(route.tab);
      setOpenResource(route.resource);
      setTutor(false);
      setPalette(false);
      setSheet(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!user || localWorkspace) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSheet(null);
        setPalette((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user]);

  async function load() {
    if (localWorkspace ? !hasLocalSession() : !auth.currentUser) return;
    const epoch = session.current;
    setLoading(true);
    try {
      const keys = ["subjects", "periods", "topics", "agenda", "schedule"];
      const [records, me] = await Promise.all([
        Promise.all(keys.map(allRows)),
        api<Row>("/me"),
      ]);
      if (epoch === session.current) {
        setData(Object.fromEntries(keys.map((key, i) => [key, records[i]])));
        setProfile(me);
      }
    } catch (e) {
      if (epoch === session.current) setError((e as Error).message);
    } finally {
      if (epoch === session.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (user && verified) void load();
  }, [user?.uid, verified]);

  async function save(value: Record<string, unknown>) {
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const { weekdays, ...single } = value;
      if (!editor.row && Array.isArray(weekdays)) {
        // Una clase en varios días son varios bloques, uno por día.
        for (const weekday of weekdays as number[])
          await api(`/${editor.collection}`, {
            method: "POST",
            body: JSON.stringify({ ...single, weekday }),
          });
      } else
        await api(
          `/${editor.collection}${editor.row ? `/${editor.row.id}` : ""}`,
          {
            method: editor.row ? "PATCH" : "POST",
            body: JSON.stringify(
              editor.row
                ? { ...value, expectedRevision: editor.row.revision }
                : value,
            ),
          },
        );
      setEditor(null);
      setNotice("Guardado en tu espacio.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(
    collection: string,
    row: Row,
    changes: Record<string, unknown>,
  ) {
    setError("");
    setPendingIds((ids) => [...ids, row.id]);
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item) =>
        item.id === row.id ? { ...item, ...changes } : item,
      ),
    }));
    try {
      await api(`/${collection}/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...changes, expectedRevision: row.revision }),
      });
      await load();
    } catch (e) {
      await load();
      setError((e as Error).message);
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== row.id));
    }
  }
  async function remove(collection: string, row: Row) {
    if (
      !window.confirm(
        "¿Eliminar este elemento? Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      await api(`/${collection}/${row.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function removeSubject(subject: Row) {
    if (
      !window.confirm(
        `¿Eliminar "${String(subject.name)}" con todos sus temas, pendientes, apuntes, conversaciones y recursos? Esto no se puede deshacer. Si solo quieres dejarla a un lado, mejor archívala.`,
      )
    )
      return;
    try {
      await api(`/subjects/${subject.id}`, { method: "DELETE" });
      setSelected(null);
      setOpenResource(null);
      await load();
      setNotice("Materia eliminada.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  // Abre un recurso desde donde sea: avisos, paleta, tutor o la hoja de crear.
  function showResource(subjectId: string, resourceId: string) {
    setTutor(false);
    setPalette(false);
    setNav("subjects");
    setSelected(subjectId);
    setTab("recursos");
    setOpenResource(resourceId);
  }
  // Abre una materia en su resumen o en la pestaña que se indique.
  function openSubject(subjectId: string, next: Tab = "resumen") {
    setNav("subjects");
    setSelected(subjectId);
    setTab(next);
    setOpenResource(null);
  }
  function createHere(draft: CreateDraft = {}) {
    setPalette(false);
    setSheet({ subjectId: selected ?? undefined, ...draft });
  }
  function navigate(key: string) {
    setNav(key);
    setSelected(null);
    setTab("resumen");
    setOpenResource(null);
    setQuery("");
    setNotice("");
  }
  const subjectName = (id: unknown) =>
    String(data.subjects.find((s) => s.id === id)?.name || "Sin materia");
  const activeSubjects = data.subjects.filter(
    (s) =>
      Boolean(s.archived) === archived &&
      String(s.name).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const subject = data.subjects.find((s) => s.id === selected);
  const firstSubject =
    data.subjects.find((s) => s.id === exampleSubjectId && !s.archived) ??
    activeSubjects[0];
  const pending = data.agenda
    .filter((item) => item.status !== "done")
    .sort((a, b) =>
      String(a.dueDate || a.dueAt || "9999").localeCompare(
        String(b.dueDate || b.dueAt || "9999"),
      ),
    );
  const displayName = String(
    profile?.displayName || (user && "email" in user && user.email?.split("@")[0]) || "Estudiante",
  );

  function subjectCards(rows: Row[]) {
    return (
      <div className="subject-grid">
        {rows.map((s) => (
          <button
            key={s.id}
            className={`subject-card accent-${s.accentId || "gold"}`}
            onClick={() => openSubject(String(s.id))}
          >
            <div>
              <h3>{String(s.name)}</h3>
              <p>
                {String(s.description || "Un nuevo espacio para aprender.")}
              </p>
              <span className="mono">
                {data.topics.filter((t) => t.subjectId === s.id).length} temas{" "}
                <span aria-hidden="true">↗</span>
              </span>
            </div>
            <Illustration id={String(s.illustrationId || "grid")} />
          </button>
        ))}
      </div>
    );
  }
  function agendaRows(rows: Row[]) {
    return (
      <div className="agenda-list">
        {rows.map((item) => (
          <article
            className={`agenda-row ${item.status === "done" ? "completed" : ""}`}
            key={item.id}
          >
            <input
              aria-label={`Completar ${item.title}`}
              type="checkbox"
              checked={item.status === "done"}
              disabled={pendingIds.includes(item.id)}
              onChange={(e) =>
                void update("agenda", item, {
                  status: e.target.checked ? "done" : "pending",
                })
              }
            />
            <div>
              <span className="eyebrow">
                {item.dueDate
                  ? String(item.dueDate)
                  : item.dueAt
                    ? new Date(String(item.dueAt)).toLocaleString("es-MX", {
                        timeZone: String(
                          profile?.timezone || "America/Mexico_City",
                        ),
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "SIN FECHA"}
              </span>
              <h3>{String(item.title)}</h3>
              <p>{subjectName(item.subjectId)}</p>
              {item.notes ? (
                <p className="quiet">{String(item.notes)}</p>
              ) : null}
            </div>
            <button
              className="text-button"
              aria-label={`Editar ${item.title}`}
              onClick={() => {
                setError("");
                setEditor({ collection: "agenda", row: item });
              }}
            >
              Editar
            </button>
            <button
              className="icon-button"
              aria-label={`Eliminar ${item.title}`}
              onClick={() => void remove("agenda", item)}
            >
              ×
            </button>
          </article>
        ))}
      </div>
    );
  }
  async function skipTutorial() {
    try {
      await api("/me", {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          career: profile?.career || "",
          timezone: profile?.timezone || "America/Mexico_City",
          tutorialStep: 5,
          expectedRevision: Number(profile?.revision || 0),
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      await api("/me", {
        method: "PUT",
        body: JSON.stringify({
          ...fields,
          tutorialStep: Number(profile?.tutorialStep || 0),
          expectedRevision: Number(profile?.revision || 0),
        }),
      });
      await load();
      setNotice("Perfil actualizado.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (initializing)
    return (
      <main className="startup">
        <PageSkeleton label="Preparando tu espacio…" />
      </main>
    );
  if (!user) return <Login />;
  if ("email" in user && !user.email?.toLowerCase().endsWith("@pcpuma.acatlan.unam.mx"))
    return (
      <main className="startup">
        <h1>Tu cuenta institucional.</h1>
        <p>
          Este espacio está disponible para correos @pcpuma.acatlan.unam.mx.
        </p>
        <button className="primary" onClick={() => void signOut(auth)}>
          Usar otra cuenta
        </button>
      </main>
    );
  if ("email" in user && !verified)
    return (
      <main className="startup">
        <h1>Verifica tu correo.</h1>
        <p>
          Revisa el mensaje que enviamos a tu correo institucional y abre su
          enlace.
        </p>
        <div className="button-row">
          <button
            className="primary"
            onClick={async () => {
              await reload(user);
              await user.getIdToken(true);
              setVerified(user.emailVerified);
            }}
          >
            Ya lo verifiqué
          </button>
          <button
            className="secondary"
            onClick={() => void sendEmailVerification(user)}
          >
            Reenviar correo
          </button>
          <button className="text-button" onClick={() => void signOut(auth)}>
            Salir
          </button>
        </div>
      </main>
    );
  return (
    <div className="campus-shell">
      <aside className={localWorkspace ? "sidebar mvp-sidebar" : "sidebar"}>
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label={localWorkspace ? "EduCloud, inicio" : "Mi Campus, inicio"}
        >
          {localWorkspace ? <>EDU<br />CLOUD</> : <>MI<br />CAMPUS</>}
        </button>
        <nav aria-label="Navegación principal">
          {[
            ["home", "home", "Inicio"],
            ["subjects", "book", "Materias"],
            ["library", "book", "Biblioteca"],
            ["agenda", "calendar", "Calendario"],
            ["profile", "user", "Mi perfil"],
          ]
            .filter(
              ([key]) =>
                !localWorkspace || ["home", "subjects", "agenda"].includes(key),
            )
            .map(([key, icon, label]) => (
              <button
                key={key}
                className={
                  nav === key || (key === "agenda" && nav === "schedule")
                    ? "active"
                    : ""
                }
                onClick={() => navigate(key)}
              >
                <span aria-hidden="true" className="nav-icon">
                  <ArtImage
                    src={`/art/icons/nav-${key === "agenda" ? "calendar" : key}.png`}
                  >
                    <Icon name={icon as IconName} size={22} />
                  </ArtImage>
                </span>
                {label}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            {localWorkspace ? (
              <button
                className="text-button"
                aria-label={`Abrir el perfil de ${displayName}`}
                onClick={() => navigate("profile")}
              >
                {displayName}
              </button>
            ) : (
              <strong>{displayName}</strong>
            )}
            <small>{String(profile?.career || "Mi espacio")}</small>
          </div>
          <button className="text-button" onClick={leaveWorkspace}>
            Salir
          </button>
        </div>
      </aside>
      <main className="workspace" id="main-content">
        <header className="topbar">
          <span className="eyebrow">
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </span>
          {!localWorkspace && (
            <div className="topbar-actions">
              <label className="search-label">
                <span className="sr-only">Buscar materias</span>
                <input
                  type="search"
                  placeholder="Buscar en tus materias…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setNav("subjects");
                    setSelected(null);
                    setOpenResource(null);
                  }}
                />
              </label>
              <button
                className="palette-button"
                onClick={() => {
                  setSheet(null);
                  setPalette(true);
                }}
                aria-label="Buscar o ir a"
                title="Buscar o ir a (Ctrl K)"
              >
                <ArtImage
                  src="/art/icons/action-search.png"
                  className="action-art"
                >
                  <Icon name="compass" size={18} />
                </ArtImage>
                <kbd>Ctrl K</kbd>
              </button>
              <button className="create-button" onClick={() => createHere()}>
                <ArtImage
                  src="/art/icons/action-create.png"
                  className="action-art"
                >
                  {null}
                </ArtImage>
                + Crear
              </button>
              <button
                className="primary tutor-button"
                onClick={() => setTutor(true)}
              >
                ✦ Abrir tutor
              </button>
            </div>
          )}
        </header>
        {error && !editor && (
          <div className="message error" role="alert">
            {error}
            <button className="text-button" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        )}
        {notice && (
          <p className="message" role="status">
            {notice}
          </p>
        )}
        {loading && (
          <div className="loading">
            <Skeleton lines={1} label="Actualizando tu espacio…" />
          </div>
        )}

        {nav === "home" && (
          <>
            <section className="hero">
              <span className="eyebrow">HOLA, {displayName.toUpperCase()}</span>
              <h1>
                TU SIGUIENTE
                <br />
                GRAN IDEA.
              </h1>
              <p className="handwritten">Un tema a la vez.</p>
              <div className="hero-mark" aria-hidden="true">
                <ArtImage src="/art/home-hero.png">
                  <Illustration id="geometry" />
                </ArtImage>
              </div>
            </section>
            {localWorkspace ? (
              <div className="home-columns">
                {firstSubject ? (
                  <section className="study-note mvp-start">
                    <div>
                      <h2>{String(firstSubject.name)}</h2>
                      <p>
                        Consulta tus apuntes, pregunta al tutor y comprueba lo
                        que aprendiste.
                      </p>
                      <button
                        className="gold-button"
                        onClick={() => openSubject(firstSubject.id, "apuntes")}
                      >
                        Ver apuntes de {String(firstSubject.name)}
                      </button>
                    </div>
                    <Illustration id={String(firstSubject.illustrationId)} />
                  </section>
                ) : (
                  !loading && (
                    <section className="panel">
                      <h2>Agrega tu primera materia</h2>
                      <button
                        className="primary"
                        onClick={() => setEditor({ collection: "subjects" })}
                      >
                        Agregar materia
                      </button>
                    </section>
                  )
                )}
                {pending.length > 0 && (
                  <aside className="upcoming">
                    <div className="section-heading">
                      <h2>Lo que viene</h2>
                    </div>
                    {agendaRows(pending.slice(0, 2))}
                  </aside>
                )}
              </div>
            ) : (
              <>
                {profile &&
                  Number(profile.tutorialStep || 0) < 5 &&
                  !data.subjects.length && (
                    <section className="onboarding">
                      <div>
                        <span className="eyebrow">PRIMERA PARADA</span>
                        <h3>Construye tu semestre a tu manera.</h3>
                        <p>
                          Crea una materia, elige su dibujo y anota tu primer
                          pendiente. El resto puede esperar.
                        </p>
                      </div>
                      <div>
                        <button
                          className="primary"
                          onClick={() => {
                            setNav("subjects");
                            setEditor({ collection: "subjects" });
                          }}
                        >
                          Crear mi primera materia
                        </button>
                        <button
                          className="text-button"
                          onClick={() => void skipTutorial()}
                        >
                          Lo haré después
                        </button>
                      </div>
                    </section>
                  )}
                <ContinueSection
                  subjects={data.subjects.filter((s) => !s.archived)}
                  onResource={showResource}
                  onSubject={(id, next) => openSubject(id, next)}
                  onCreate={(id) => createHere({ subjectId: id })}
                />
                <div className="home-columns">
                  <section>
                    <div className="section-heading">
                      <h2>Mis materias</h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setEditor({ collection: "subjects" });
                        }}
                      >
                        + Agregar materia
                      </button>
                    </div>
                    {subjectCards(
                      data.subjects.filter((s) => !s.archived).slice(0, 4),
                    )}
                    {!data.subjects.some((s) => !s.archived) && (
                      <div className="empty-state">
                        <span aria-hidden="true">↗</span>
                        <h3>Aquí empieza tu siguiente idea.</h3>
                        <p>
                          Agrega la materia que quieras. Su nombre, temas e
                          ilustración los eliges tú.
                        </p>
                      </div>
                    )}
                    <div className="study-note">
                      <span className="eyebrow">A TU RITMO</span>
                      <h2>
                        Un poco de orden.
                        <br />
                        Más espacio para aprender.
                      </h2>
                      <p>
                        Empieza por lo que tienes pendiente y reserva un momento
                        para tus preguntas.
                      </p>
                      <button
                        className="gold-button"
                        onClick={() => navigate("agenda")}
                      >
                        Organizar mi semana →
                      </button>
                    </div>
                  </section>
                  <aside className="upcoming">
                    <div className="section-heading">
                      <h2>Lo que viene</h2>
                    </div>
                    {pending.length ? (
                      agendaRows(pending.slice(0, 4))
                    ) : (
                      <div className="empty-state">
                        <h3>Una semana por escribir.</h3>
                        <p>Anota tareas, exámenes o momentos de estudio.</p>
                        <button
                          className="secondary"
                          onClick={() => setEditor({ collection: "agenda" })}
                        >
                          Agregar pendiente
                        </button>
                      </div>
                    )}
                    <section className="passport-note">
                      <span className="eyebrow">CADA PASO CUENTA</span>
                      <h3>Tu camino, a la vista.</h3>
                      <PassportSummary onOpen={() => navigate("profile")} />
                      <div aria-hidden="true">✧ ── ✧ ── ✧</div>
                    </section>
                  </aside>
                </div>
              </>
            )}
          </>
        )}

        {nav === "library" && (
          <Library
            key={user.uid}
            subjects={data.subjects.filter((s) => !s.archived)}
            onOpen={showResource}
            onCreate={() => createHere()}
          />
        )}

        {nav === "subjects" && !subject && (
          <>
            <div className="page-heading">
              <span className="eyebrow">TU MAPA DEL SEMESTRE</span>
              <h1>Mis materias.</h1>
              <p>No hay un camino único. Construye el tuyo.</p>
            </div>
            <div className="section-heading">
              <button
                className="secondary"
                onClick={() => setArchived(!archived)}
              >
                {archived ? "Ver activas" : "Ver archivadas"}
              </button>
              <button
                className="primary"
                onClick={() => {
                  setError("");
                  setEditor({ collection: "subjects" });
                }}
              >
                + Nueva materia
              </button>
            </div>
            {subjectCards(activeSubjects)}
            {!activeSubjects.length && (
              <div className="empty-state">
                <h3>
                  {query
                    ? "No encontramos esa materia."
                    : archived
                      ? "No hay materias archivadas."
                      : "Tu próxima materia empieza aquí."}
                </h3>
                <p>
                  {query
                    ? "Prueba con otro nombre."
                    : "Crea una materia con el nombre y la ilustración que quieras."}
                </p>
              </div>
            )}
          </>
        )}

        {nav === "subjects" && subject && (
          <>
            <button
              className="text-button"
              onClick={() => {
                setSelected(null);
                setTab("resumen");
                setOpenResource(null);
              }}
            >
              ← Todas mis materias
            </button>
            <section className="subject-hero compact">
              <div>
                <span className="eyebrow">TU ESPACIO PARA ENTENDER</span>
                <h1>{String(subject.name)}</h1>
                <p>
                  {String(
                    subject.description || "Cada pregunta abre un camino.",
                  )}
                </p>
              </div>
              <Illustration id={String(subject.illustrationId)} />
            </section>
            <div
              className="subject-tabs"
              role="tablist"
              aria-label="Secciones de la materia"
            >
              {TABS.map((t) => {
                const count =
                  t.id === "pendientes"
                    ? data.agenda.filter(
                        (a) =>
                          a.subjectId === subject.id && a.status !== "done",
                      ).length
                    : 0;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls="subject-panel"
                    className={tab === t.id ? "on" : ""}
                    onClick={() => {
                      setTab(t.id);
                      setOpenResource(null);
                    }}
                  >
                    <span className="tab-icon" aria-hidden="true">
                      <ArtImage src={`/art/icons/tab-${t.art}.png`}>
                        <Icon name={t.icon} size={18} />
                      </ArtImage>
                    </span>
                    {t.label}
                    {count > 0 && <span className="tab-count">{count}</span>}
                  </button>
                );
              })}
            </div>
            <div
              id="subject-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="subject-panel"
            >
              {tab === "resumen" && (
                <>
                  <div className="subject-quick">
                    {!localWorkspace && (
                      <button
                        className="primary"
                        onClick={() => createHere({ subjectId: subject.id })}
                      >
                        + Crear un recurso
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => setTab("apuntes")}
                    >
                      {localWorkspace ? "Ver apuntes" : "Subir apuntes"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setTutor(true)}
                    >
                      ✦ Preguntar al tutor
                    </button>
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Temas</h2>
                      <button
                        className="text-button"
                        onClick={() =>
                          setEditor({
                            collection: "topics",
                            subjectId: subject.id,
                          })
                        }
                      >
                        + Agregar tema
                      </button>
                    </div>
                    {data.topics
                      .filter((t) => t.subjectId === subject.id)
                      .sort((a, b) => Number(a.order) - Number(b.order))
                      .map((t, i) => (
                        <div className="topic-row" key={t.id}>
                          <span className="topic-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{String(t.title)}</h3>
                            <p className="quiet">
                              {((t.prerequisiteIds as string[]) || []).length
                                ? `Antes: ${(t.prerequisiteIds as string[]).map((id) => String(data.topics.find((other) => other.id === id)?.title || "Tema")).join(", ")}`
                                : "Sin prerrequisitos"}
                            </p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() =>
                              setEditor({
                                collection: "topics",
                                row: t,
                                subjectId: subject.id,
                              })
                            }
                          >
                            Editar
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Eliminar ${t.title}`}
                            onClick={() => void remove("topics", t)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    {!data.topics.some((t) => t.subjectId === subject.id) && (
                      <p>
                        Divide la materia en temas pequeños para encontrar por
                        dónde empezar.
                      </p>
                    )}
                  </section>
                  <section className="subject-manage">
                    <button
                      className="secondary"
                      onClick={() =>
                        setEditor({ collection: "subjects", row: subject })
                      }
                    >
                      Editar materia
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        void update("subjects", subject, {
                          archived: !subject.archived,
                        })
                      }
                    >
                      {subject.archived
                        ? "Restaurar materia"
                        : "Archivar materia"}
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => void removeSubject(subject)}
                    >
                      Eliminar materia
                    </button>
                  </section>
                </>
              )}

              {tab === "pendientes" && (
                <section>
                  <div className="section-heading">
                    <h2>Pendientes de la materia</h2>
                    <button
                      className="text-button"
                      onClick={() =>
                        setEditor({
                          collection: "agenda",
                          subjectId: subject.id,
                        })
                      }
                    >
                      + Agregar
                    </button>
                  </div>
                  {agendaRows(
                    data.agenda.filter((a) => a.subjectId === subject.id),
                  )}
                  {!data.agenda.some((a) => a.subjectId === subject.id) && (
                    <p className="quiet">
                      Anota aquí tareas y exámenes de esta materia.
                    </p>
                  )}
                </section>
              )}

              {tab === "apuntes" && (
                <MaterialsPanel
                  key={`${user.uid}:${subject.id}`}
                  subjectId={subject.id}
                  topics={data.topics.filter((t) => t.subjectId === subject.id)}
                  onTopicsChanged={() => void load()}
                  onAsk={localWorkspace ? () => setTutor(true) : undefined}
                  onPractice={
                    localWorkspace && subject.id === exampleSubjectId
                      ? () => showResource(subject.id, exampleQuizId)
                      : undefined
                  }
                />
              )}

              {tab === "recursos" && (
                <ResourcesPanel
                  key={`resources:${user.uid}:${subject.id}`}
                  subjectId={subject.id}
                  resourceId={openResource}
                  onResourceChange={setOpenResource}
                  onCreate={() => createHere({ subjectId: subject.id })}
                />
              )}
            </div>
          </>
        )}

        {(nav === "agenda" || nav === "schedule") && (
          <>
            <div className="page-heading">
              <span className="eyebrow">
                {nav === "agenda" ? "UN PASO ANTES" : "TU SEMANA, TU RITMO"}
              </span>
              <h1>Mi calendario.</h1>
              <p>
                {nav === "agenda"
                  ? "Haz espacio para las cosas que importan."
                  : "Bloques semanales en la zona horaria de cada clase."}
              </p>
            </div>
            <div
              className="subject-tabs calendar-tabs"
              role="tablist"
              aria-label="Secciones del calendario"
            >
              {(
                [
                  ["agenda", "Pendientes"],
                  ["schedule", "Horario"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={nav === key}
                  className={nav === key ? "on" : ""}
                  onClick={() => setNav(key)}
                >
                  {label}
                  {key === "agenda" && pending.length > 0 && (
                    <span className="tab-count">{pending.length}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {nav === "agenda" && (
          <>
            <div className="section-heading">
              <h2>Pendientes y exámenes</h2>
              <button
                className="primary"
                onClick={() => setEditor({ collection: "agenda" })}
              >
                + Nuevo pendiente
              </button>
            </div>
            {agendaRows([
              ...pending,
              ...data.agenda.filter((a) => a.status === "done"),
            ])}
            {!data.agenda.length && (
              <div className="empty-state">
                <ArtImage src="/art/empty-agenda.png" className="empty-art">
                  {null}
                </ArtImage>
                <h3>Sin pendientes todavía.</h3>
                <p>Agrega una tarea, un examen o un momento de estudio.</p>
              </div>
            )}
          </>
        )}

        {nav === "schedule" && (
          <>
            <div className="section-heading">
              <h2>Semana habitual</h2>
              <button
                className="primary"
                onClick={() => setEditor({ collection: "schedule" })}
                disabled={!data.subjects.length}
              >
                + Agregar clase
              </button>
            </div>
            {!data.subjects.length && (
              <p>Crea una materia antes de agregarla al horario.</p>
            )}
            <div className="week-grid">
              {weekdays.map((day, i) => (
                <section className="day-column" key={day}>
                  <h3>{day}</h3>
                  {data.schedule
                    .filter((s) => s.weekday === i)
                    .sort((a, b) =>
                      String(a.localStart).localeCompare(String(b.localStart)),
                    )
                    .map((s) => (
                      <article key={s.id}>
                        <span className="mono">
                          {String(s.localStart).slice(0, 5)}–
                          {String(s.localEnd).slice(0, 5)}
                        </span>
                        <h4>{subjectName(s.subjectId)}</h4>
                        <small>{String(s.timezone)}</small>
                        <p>{String(s.notes || "")}</p>
                        <button
                          className="text-button"
                          aria-label={`Editar clase ${subjectName(s.subjectId)}`}
                          onClick={() =>
                            setEditor({ collection: "schedule", row: s })
                          }
                        >
                          Editar
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Eliminar clase ${subjectName(s.subjectId)}`}
                          onClick={() => void remove("schedule", s)}
                        >
                          ×
                        </button>
                      </article>
                    ))}
                </section>
              ))}
            </div>
          </>
        )}

        {nav === "profile" && (
          <>
            <div className="page-heading">
              <span className="eyebrow">HECHO A TU MEDIDA</span>
              <h1>Mi espacio.</h1>
            </div>
            <div className="profile-grid">
              {!localWorkspace && <PassportPanel />}
              <section className="panel">
                <h2>Tu perfil</h2>
                <form onSubmit={saveProfile}>
                  <label>
                    Cómo te llamamos
                    <input
                      name="displayName"
                      required
                      maxLength={100}
                      defaultValue={String(profile?.displayName || displayName)}
                    />
                  </label>
                  <label>
                    Carrera (opcional)
                    <input
                      name="career"
                      maxLength={120}
                      defaultValue={String(profile?.career || "")}
                    />
                  </label>
                  <label>
                    Zona horaria
                    <input
                      name="timezone"
                      required
                      defaultValue={String(
                        profile?.timezone || "America/Mexico_City",
                      )}
                    />
                  </label>
                  <button className="primary">Guardar perfil</button>
                </form>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>Periodos</h2>
                  <button
                    className="text-button"
                    onClick={() => setEditor({ collection: "periods" })}
                  >
                    + Nuevo
                  </button>
                </div>
                {data.periods.map((p) => (
                  <div className="period-row" key={p.id}>
                    <div>
                      <h3>{String(p.name)}</h3>
                      <small>
                        {String(p.startDate || "Sin inicio")} /{" "}
                        {String(p.endDate || "Sin fin")}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        setEditor({ collection: "periods", row: p })
                      }
                    >
                      Editar
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Eliminar periodo ${p.name}`}
                      onClick={() => void remove("periods", p)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!data.periods.length && (
                  <p>
                    Puedes organizar tus materias por semestre o dejarlas
                    independientes.
                  </p>
                )}
              </section>
            </div>
            <DataPanel />
          </>
        )}
      </main>
      {editor && (
        <Editor
          state={editor}
          subjects={data.subjects}
          periods={data.periods}
          topics={data.topics}
          busy={busy}
          error={error}
          onSave={save}
          onClose={() => {
            setEditor(null);
            setError("");
          }}
        />
      )}
      <ResourceToasts onOpen={showResource} />
      {!localWorkspace && !tutor && !sheet && !palette && !editor && (
        <button
          className="tutor-fab"
          onClick={() => setTutor(true)}
          aria-label={
            subject
              ? `Preguntar al tutor sobre ${String(subject.name)}`
              : "Preguntar al tutor"
          }
        >
          <span className="tutor-fab-face" aria-hidden="true">
            <ArtImage src="/art/icons/action-tutor.png">
              <Icon name="spark" size={26} />
            </ArtImage>
          </span>
          <span className="tutor-fab-label" aria-hidden="true">
            {subject
              ? `Preguntar sobre ${String(subject.name)}`
              : "Preguntar al tutor"}
          </span>
        </button>
      )}
      {sheet && (
        <CreateSheet
          subjects={data.subjects.filter((x) => !x.archived)}
          draft={sheet}
          onClose={() => setSheet(null)}
          onCreated={({ subjectId, resourceId }) =>
            showResource(subjectId, resourceId)
          }
        />
      )}
      {palette && (
        <CommandPalette
          subjects={data.subjects.filter((x) => !x.archived)}
          onClose={() => setPalette(false)}
          onGo={navigate}
          onSubject={(id) => openSubject(id)}
          onCreate={(kind?: Kind) => createHere({ kind })}
          onTutor={() => setTutor(true)}
          onResource={showResource}
        />
      )}
      {tutor && (
        <Suspense
          fallback={
            <aside className="tutor-drawer study-tutor">
              <Skeleton lines={6} label="Abriendo tu tutor…" />
            </aside>
          }
        >
          <TutorPanel
            key={user.uid}
            subjects={data.subjects.filter((s) => !s.archived)}
            initialSubjectId={selected}
            onClose={() => setTutor(false)}
            onOpenResource={showResource}
            onEditAction={(subjectId, action) => {
              setTutor(false);
              setSheet({
                subjectId,
                kind: action.kind as Kind,
                instruction: action.instruction,
              });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
