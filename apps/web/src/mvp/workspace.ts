import type { Row } from "../api";
import type { Kind } from "../features/resources/types";
import {
  canDeleteLocalResource,
  exampleNoteId,
  noteBlock,
  ohmResource,
  sampleResource,
  seedWorkspace,
  subjectId,
  type OhmChallenge,
} from "./fixtures";

export const localWorkspace = import.meta.env.VITE_EDUCLOUD_MVP === "true";
export type LocalSession = { uid: "local"; local: true };
const sessionKey = "educloud.local.session.v1";
const dataKey = "educloud.local.data.v1";
const change = "educloud:local-session";
let memorySession = false;
type WorkspaceState = ReturnType<typeof seedWorkspace>;
let state: WorkspaceState | undefined;

function readState() {
  if (state) return state;
  try {
    const saved = localStorage.getItem(dataKey);
    if (saved) {
      const parsed = JSON.parse(saved) as WorkspaceState | null;
      if (
        parsed &&
        Array.isArray(parsed.lists.subjects) &&
        Array.isArray(parsed.resources)
      ) {
        state = parsed;
        return state;
      }
    }
  } catch {
    // A blocked or invalid local store starts a fresh workspace.
  }
  state = seedWorkspace();
  return state;
}
function persist() {
  try {
    localStorage.setItem(dataKey, JSON.stringify(readState()));
  } catch {
    // The workspace remains usable in the open tab.
  }
}

function clearResourceHistory(db: WorkspaceState, versions: Set<string>) {
  db.attempts = db.attempts.filter(
    (attempt) => !versions.has(attempt.versionId),
  );
  for (const version of versions) delete db.reviews[version];
}
export function hasLocalSession() {
  try {
    return memorySession || localStorage.getItem(sessionKey) === "1";
  } catch {
    return memorySession;
  }
}
export function observeLocalSession(
  callback: (value: LocalSession | null) => void,
) {
  const update = () =>
    callback(hasLocalSession() ? { uid: "local", local: true } : null);
  update();
  window.addEventListener(change, update);
  return () => window.removeEventListener(change, update);
}
export function openLocalSession(name?: string) {
  if (name?.trim()) {
    readState().profile.displayName = name.trim().slice(0, 70);
    persist();
  }
  memorySession = true;
  try {
    localStorage.setItem(sessionKey, "1");
  } catch {
    /* memory fallback */
  }
  window.dispatchEvent(new Event(change));
}
export function closeLocalSession() {
  memorySession = false;
  try {
    localStorage.removeItem(sessionKey);
  } catch {
    /* memory fallback */
  }
  window.dispatchEvent(new Event(change));
}

export function attachLocalFile(target: string, file: File, name?: string) {
  const db = readState();
  if (db.materials.filter((m) => m.status === "local").length >= 50)
    throw new Error("Ya tienes 50 archivos adjuntos en este navegador.");
  db.materials.push({
    id: crypto.randomUUID(),
    revision: 1,
    subjectId: target,
    name: (name || file.name).slice(0, 160),
    size: file.size,
    status: "local",
    mediaType: file.type || "application/octet-stream",
  });
  // Store metadata only. File contents stay in the browser's original file picker.
  persist();
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const items = (rows: unknown[]) => json({ items: rows, nextCursor: null });
const missing = () => json({ message: "No encontramos este elemento." }, 404);
const unavailable = (message: string) => json({ message }, 422);
const resourceLimit = () =>
  unavailable("Ya tienes 30 recursos en este navegador.");
const row = (data: Record<string, unknown>): Row => ({
  ...data,
  revision: 1,
  id: crypto.randomUUID(),
});

function edit<T extends Row>(current: T, data: Record<string, unknown>) {
  const { expectedRevision: _revision, id: _id, ...fields } = data;
  Object.assign(current, fields, { revision: current.revision + 1 });
  persist();
  return json(current);
}

async function askTutor(
  thread: Row,
  payload: Record<string, unknown>,
  options: RequestInit,
) {
  const db = readState();
  const question =
    typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 480)
    return unavailable("Escribe una pregunta de hasta 480 caracteres.");
  const isExample =
    thread.subjectId === subjectId &&
    db.materials.some((m) => m.id === exampleNoteId);
  const sourceSelected =
    isExample &&
    (thread.materialIds as string[] | undefined)?.includes(exampleNoteId);
  if (
    (thread.materialIds as string[] | undefined)?.some(
      (id) => id !== exampleNoteId,
    )
  )
    return unavailable(
      "El tutor puede consultar el apunte Ley de Ohm. Los archivos adjuntos se quedan en este navegador.",
    );
  const allowGeneral =
    payload.allowGeneralForTurn === true || thread.sourceMode === "general";
  let text = "";
  let citations: unknown[] = [];
  let needsConsent = !sourceSelected && !allowGeneral;
  if (!needsConsent) {
    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        question,
        source: Boolean(sourceSelected),
        allowGeneral,
        mode: thread.assistanceMode,
        personality: thread.personalityId,
        length: thread.responseLength,
      }),
    }).catch(() => null);
    const answer = await response?.json().catch(() => null);
    if (!response?.ok || typeof answer?.text !== "string") {
      return json(
        {
          message:
            answer?.message ||
            "Por ahora no se pudo conectar con el tutor. Intenta de nuevo.",
        },
        response?.ok ? 502 : (response?.status ?? 503),
      );
    }
    text = answer.text;
    needsConsent = answer.needsConsent === true && !allowGeneral;
    if (
      sourceSelected &&
      answer.cited &&
      typeof answer.quote === "string" &&
      answer.quote &&
      noteBlock.text.includes(answer.quote)
    )
      citations = [{ ...noteBlock, sourceId: "S1", quote: answer.quote }];
  }
  const turn = row({
    conversationId: thread.id,
    question,
    text,
    status: "succeeded",
    stage: "succeeded",
    citations,
    sequence: 1,
    needsConsent,
    usageUnknown: false,
    sourcesChanged: false,
    partialSources: false,
    jobId: "",
    sourceMode: sourceSelected ? "selected_material" : "general",
  });
  db.turns.push(turn);
  if (db.turns.length > 120) db.turns.shift();
  persist();
  return json(turn, 201);
}

function getProgress(target: string) {
  const db = readState();
  const resources = db.resources.filter(
    (r) => r.subjectId === target && !r.archived,
  );
  const versionIds = resources.flatMap((r) => r.versions.map((v) => v.id));
  const attempts = db.attempts.filter((a) => versionIds.includes(a.versionId));
  const marks = versionIds.flatMap((id) => Object.values(db.reviews[id] ?? {}));
  const recent = attempts
    .slice(-5)
    .map((a) => Math.round((100 * a.score) / a.total));
  const quiz = resources.find((r) => r.kind === "quiz");
  return {
    materialsReady: db.materials.filter(
      (m) => m.subjectId === target && m.status === "ready",
    ).length,
    resourcesReady: resources.length,
    quizAttempts: attempts.length,
    averageScore: recent.length
      ? Math.round(recent.reduce((a, b) => a + b) / recent.length)
      : null,
    lastScore: recent.at(-1) ?? null,
    cardsKnown: marks.filter((m) => m === "known").length,
    cardsToReview: marks.filter((m) => m === "again").length,
    recommendations: quiz
      ? [
          {
            text:
              recent.length && recent.at(-1)! >= 85
                ? "¡Buen trabajo! Repasa tus tarjetas o vuelve a consultar el apunte."
                : recent.length
                  ? "Repasa cómo se relacionan voltaje, corriente y resistencia."
                  : "Prueba el cuestionario para ver cómo vas.",
            resourceId: quiz.id,
          },
        ]
      : [],
  };
}

function getPassport() {
  const db = readState();
  const stamps = [
    {
      id: "first_material",
      title: "Primeros apuntes",
      description: "Guarda tus primeros apuntes.",
      earned: db.materials.length > 0,
    },
    {
      id: "first_question",
      title: "Primera pregunta",
      description: "Haz una pregunta al tutor.",
      earned: db.turns.some((t) => Boolean(t.text)),
    },
    {
      id: "first_resource",
      title: "Primer recurso",
      description: "Crea un recurso de estudio.",
      earned: db.resources.length > 0,
    },
    {
      id: "explorer",
      title: "Explorador",
      description: "Prueba un recurso interactivo.",
      earned: false,
    },
    {
      id: "first_quiz",
      title: "Primer cuestionario",
      description: "Completa un cuestionario.",
      earned: db.attempts.length > 0,
    },
    {
      id: "perfect_quiz",
      title: "Sin errores",
      description: "Consigue todos los aciertos.",
      earned: db.attempts.some((a) => a.score === a.total),
    },
    {
      id: "cards_ten",
      title: "Diez tarjetas",
      description: "Repasa diez tarjetas.",
      earned: Object.values(db.reviews).flatMap(Object.keys).length >= 10,
    },
    {
      id: "three_subjects",
      title: "Tres materias",
      description: "Organiza tres materias.",
      earned: db.lists.subjects.length >= 3,
    },
  ].map((stamp) => ({
    ...stamp,
    earnedAt: stamp.earned ? new Date().toISOString() : null,
  }));
  return {
    stamps,
    earned: stamps.filter((s) => s.earned).length,
    total: stamps.length,
  };
}

export async function localRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  options.signal?.throwIfAborted();
  if (!hasLocalSession())
    return json({ message: "Abre tu espacio para continuar." }, 401);
  const db = readState();
  const url = new URL(path, window.location.origin);
  const [area, id, action, tail] = url.pathname.split("/").filter(Boolean);
  const method = options.method ?? "GET";
  const body =
    typeof options.body === "string"
      ? (JSON.parse(options.body) as Record<string, unknown>)
      : {};

  if (area === "me") {
    if (id === "delete" && method === "POST") {
      if (body.confirm !== "ELIMINAR")
        return unavailable("Falta confirmar el borrado.");
      state = undefined;
      try {
        localStorage.removeItem(dataKey);
      } catch {
        /* memory fallback */
      }
      return json({ deleted: true });
    }
    return method === "PUT" ? edit(db.profile, body) : json(db.profile);
  }
  if (area === "passport") return json(getPassport());
  if (area === "subjects" && id && action) {
    if (!db.lists.subjects.some((subject) => subject.id === id))
      return missing();
    if (action === "materials")
      return items(db.materials.filter((m) => m.subjectId === id));
    if (action === "resources")
      return items(db.resources.filter((r) => r.subjectId === id));
    if (action === "progress") return json(getProgress(id));
  }
  if (Object.hasOwn(db.lists, area) && !action) {
    const rows = db.lists[area];
    const current = rows.find((r) => r.id === id);
    if (!id && method === "GET") return items(rows);
    if (!id && method === "POST") {
      const created = row(body);
      rows.push(created);
      persist();
      return json(created, 201);
    }
    if (!current) return missing();
    if (method === "PATCH") return edit(current, body);
    if (method === "DELETE") {
      rows.splice(rows.indexOf(current), 1);
      if (area === "subjects") {
        const elsewhere = (value: { subjectId?: unknown }) =>
          value.subjectId !== id;
        const conversationIds = new Set(
          db.conversations.filter((c) => c.subjectId === id).map((c) => c.id),
        );
        const versions = new Set(
          db.resources
            .filter((r) => r.subjectId === id)
            .flatMap((r) => r.versions.map((v) => v.id)),
        );
        for (const key of ["agenda", "schedule", "topics"])
          db.lists[key] = db.lists[key].filter((r) =>
            elsewhere({ subjectId: r.subjectId }),
          );
        db.materials = db.materials.filter((r) =>
          elsewhere({ subjectId: r.subjectId }),
        );
        db.resources = db.resources.filter(elsewhere);
        db.conversations = db.conversations.filter((r) =>
          elsewhere({ subjectId: r.subjectId }),
        );
        db.turns = db.turns.filter(
          (r) => !conversationIds.has(String(r.conversationId)),
        );
        clearResourceHistory(db, versions);
      }
      persist();
      return new Response(null, { status: 204 });
    }
  }
  if (area === "materials") {
    const material = db.materials.find((r) => r.id === id);
    if (!material) return missing();
    if (action === "original" && id === exampleNoteId)
      return new Response(noteBlock.text, {
        headers: { "Content-Type": "text/plain" },
      });
    if (action === "transcript" && id === exampleNoteId)
      return unavailable("El apunte de referencia conserva su texto original.");
    if (!action) return json(material);
  }
  if (area === "citations" && id === "resolve" && method === "POST") {
    if (
      !db.materials.some((m) => m.id === exampleNoteId) ||
      body.materialId !== exampleNoteId ||
      body.extractionVersion !== noteBlock.extractionVersion ||
      body.blockId !== noteBlock.blockId ||
      body.locator !== noteBlock.locator ||
      (typeof body.quote === "string" && !noteBlock.text.includes(body.quote))
    )
      return missing();
    return json(noteBlock);
  }
  if (area === "conversations") {
    if (!id && method === "GET")
      return items(
        db.conversations.filter(
          (r) => r.subjectId === url.searchParams.get("subjectId"),
        ),
      );
    if (!id && method === "POST") {
      if (db.conversations.length >= 30)
        return unavailable("Ya tienes 30 conversaciones en este navegador.");
      const created = row(body);
      db.conversations.push(created);
      persist();
      return json(created, 201);
    }
    const thread = db.conversations.find((r) => r.id === id);
    if (!thread) return missing();
    if (action === "turns")
      return method === "POST"
        ? askTutor(thread, body, options)
        : items(db.turns.filter((r) => r.conversationId === id));
    return method === "PATCH" ? edit(thread, body) : json(thread);
  }
  if (area === "turns") {
    const turn = db.turns.find((r) => r.id === id);
    return turn ? json(turn) : missing();
  }
  if (area === "resources") {
    if (!id && method === "POST") {
      if (body.subjectId !== subjectId)
        return unavailable(
          "Los recursos preparados están disponibles en Circuitos eléctricos.",
        );
      if (db.resources.length >= 30) return resourceLimit();
      if (body.kind === "interactive") {
        const hasSource = () =>
          db.lists.subjects.some(
            (subject) => subject.id === subjectId && !subject.archived,
          ) &&
          db.materials.some(
            (material) =>
              material.id === exampleNoteId && material.status === "ready",
          );
        if (!hasSource())
          return unavailable(
            "Abre el apunte de la ley de Ohm para crear el recurso.",
          );
        const response = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: options.signal,
          body: JSON.stringify({ action: "create-ohm-challenge" }),
        });
        if (!response.ok)
          return json(
            {
              message:
                response.status === 429
                  ? "Hay muchas solicitudes ahora. Intenta de nuevo en un momento."
                  : "No se pudo crear el recurso. Intenta de nuevo.",
            },
            response.status,
          );
        const challenge: OhmChallenge = await response.json();
        options.signal?.throwIfAborted();
        if (!hasLocalSession() || db !== state || !hasSource())
          return missing();
        if (db.resources.length >= 30) return resourceLimit();
        const resource = ohmResource(challenge);
        db.resources.push(resource);
        persist();
        return json(resource, 201);
      }
      const resource = sampleResource(
        crypto.randomUUID(),
        body.kind as Kind,
        subjectId,
        "Repaso de la ley de Ohm",
      );
      if (!resource)
        return unavailable(
          "Por ahora puedes abrir los recursos de estudio disponibles en la biblioteca.",
        );
      db.resources.push(resource);
      persist();
      return json(resource, 201);
    }
    if (id === "versions") {
      const version = db.resources
        .flatMap((r) => r.versions)
        .find((v) => v.id === action);
      if (!version) return missing();
      if (
        tail === "attempts" &&
        method === "POST" &&
        Array.isArray(body.answers)
      ) {
        const questions: { correctIndex: number }[] =
          version.content?.questions ?? [];
        const answers = body.answers;
        if (!questions.length || answers.length !== questions.length)
          return unavailable("Completa el cuestionario antes de guardarlo.");
        const attempt = {
          versionId: version.id,
          score: questions.filter((q, i) => q.correctIndex === answers[i])
            .length,
          total: questions.length,
        };
        db.attempts.push(attempt);
        if (db.attempts.length > 120) db.attempts.shift();
        persist();
        return json(attempt, 201);
      }
      if (tail === "review") {
        const cards = (db.reviews[version.id] ??= {});
        if (method === "PUT" || method === "POST" || method === "PATCH") {
          const submitted = body.cards ?? body.review;
          if (submitted && typeof submitted === "object")
            Object.assign(cards, submitted);
          if (typeof body.cardId === "string" && typeof body.state === "string")
            cards[body.cardId] = body.state;
          persist();
        }
        return json({ cards });
      }
      if (tail === "state") return json({ state: null, revision: 0 });
    }
    const detail = db.resources.find((r) => r.id === id);
    if (!detail) return missing();
    if (!action && method === "DELETE") {
      if (!canDeleteLocalResource(detail.id))
        return unavailable("Este recurso viene incluido en la materia.");
      db.resources = db.resources.filter(
        (resource) => resource.id !== detail.id,
      );
      clearResourceHistory(
        db,
        new Set(detail.versions.map((version) => version.id)),
      );
      persist();
      return new Response(null, { status: 204 });
    }
    if (action === "versions")
      return unavailable(
        "Las versiones de este recurso están preparadas para consulta.",
      );
    if (method === "PATCH") {
      if (typeof body.title === "string")
        detail.title = body.title.slice(0, 160);
      if (typeof body.archived === "boolean") detail.archived = body.archived;
      detail.revision++;
      persist();
    }
    return json(detail);
  }
  return missing();
}
