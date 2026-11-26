import note from "../../shared/ohm.json";
import type { Row } from "../api";
import type {
  Kind,
  ResourceDetail,
  ResourceVersion,
} from "../features/resources/types";

export const subjectId = "circuitos";
export const exampleNoteId = "ley-de-ohm";
export const exampleQuizId = "practica-ohm";
export const noteBlock = {
  materialId: exampleNoteId,
  extractionVersion: "apunte-1",
  blockId: "section-1",
  locator: "section:1",
  text: note.text,
  status: "ready",
};
export const sampleNote = {
  id: exampleNoteId,
  revision: 1,
  subjectId,
  name: note.title,
  mediaType: "text/plain",
  status: "ready",
  topicIds: ["ohm"],
  blocks: [noteBlock],
};

export const practiceContent = {
  questions: [
    {
      prompt:
        "Un circuito tiene 12 V y una resistencia de 6 Ω. ¿Cuál es su corriente?",
      options: ["1 A", "2 A", "6 A", "72 A"],
      correctIndex: 1,
      explanation: "Usa I = V / R. Al dividir 12 V entre 6 Ω obtienes 2 A.",
    },
  ],
};
const contents: Partial<Record<Kind, ResourceVersion["content"]>> = {
  summary: {
    overview: "La ley de Ohm describe la relación $$V = I \\times R$$.",
    sections: [
      {
        heading: "Un ejemplo",
        body: "Para 12 V y 6 Ω, la corriente es de 2 A.",
      },
    ],
    keyPoints: [
      "A mayor resistencia, menor corriente si el voltaje no cambia.",
    ],
  },
  concepts: {
    concepts: [
      {
        term: "Voltaje",
        definition: "Diferencia de potencial eléctrico. Se mide en voltios.",
      },
      {
        term: "Resistencia",
        definition: "Oposición al paso de la corriente. Se mide en ohmios.",
      },
      {
        term: "Corriente",
        definition: "Flujo de carga eléctrica. Se mide en amperios.",
      },
    ],
  },
  flashcards: {
    cards: [
      {
        front: "¿Cómo calculas la corriente con la ley de Ohm?",
        back: "$I = V / R$.",
      },
      { front: "¿Cuál es la unidad de la resistencia?", back: "El ohmio (Ω)." },
    ],
  },
  quiz: practiceContent,
};

export function sampleResource(
  id: string,
  kind: Kind,
  target: string,
  title: string,
): ResourceDetail | null {
  const content = contents[kind];
  if (!content) return null;
  const versionId = "v-" + id;
  return {
    id,
    revision: 1,
    subjectId: target,
    kind,
    title,
    materialIds: [exampleNoteId],
    archived: false,
    versionCount: 1,
    latestStatus: "succeeded",
    currentVersionId: versionId,
    latestVersionId: versionId,
    versions: [
      {
        id: versionId,
        resourceId: id,
        number: 1,
        instruction: "Repasar la ley de Ohm",
        status: "succeeded",
        stage: "succeeded",
        usageUnknown: false,
        jobId: "",
        content,
        citations: [{ ...noteBlock }],
        sourcesChanged: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function seedWorkspace() {
  const nextDay = new Date(Date.now() + 86_400_000);
  const dueDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDay);
  const lists: Record<string, Row[]> = {
    periods: [
      {
        id: "semestre",
        revision: 1,
        name: "Mi semestre",
        startDate: dueDate,
        endDate: dueDate,
      },
    ],
    subjects: [
      {
        id: subjectId,
        revision: 1,
        name: "Circuitos eléctricos",
        periodId: "semestre",
        illustrationId: "circuit",
        color: "blue",
        archived: false,
      },
    ],
    topics: [
      {
        id: "ohm",
        revision: 1,
        subjectId,
        title: "Ley de Ohm",
        prerequisiteIds: [],
      },
    ],
    agenda: [
      {
        id: "repaso",
        revision: 1,
        subjectId,
        title: "Repasar la ley de Ohm",
        status: "pending",
        dueDate,
        importance: "normal",
      },
    ],
    schedule: [
      {
        id: "clase",
        revision: 1,
        subjectId,
        weekday: 2,
        localStart: "10:00",
        localEnd: "11:30",
        timezone: "America/Mexico_City",
        notes: "Acatlán",
      },
    ],
  };
  return {
    profile: {
      id: "local",
      revision: 1,
      displayName: "Estudiante",
      career: "",
      timezone: "America/Mexico_City",
      tutorialStep: 5,
    } as Row,
    lists,
    materials: [sampleNote] as Row[],
    resources: [
      sampleResource(
        exampleQuizId,
        "quiz",
        subjectId,
        "Práctica de la ley de Ohm",
      )!,
      sampleResource(
        "tarjetas-ohm",
        "flashcards",
        subjectId,
        "Tarjetas de circuitos",
      )!,
      sampleResource(
        "resumen-ohm",
        "summary",
        subjectId,
        "Ley de Ohm en breve",
      )!,
    ],
    conversations: [] as Row[],
    turns: [] as Row[],
    attempts: [] as { versionId: string; score: number; total: number }[],
    reviews: {} as Record<string, Record<string, string>>,
  };
}
