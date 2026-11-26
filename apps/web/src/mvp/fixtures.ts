import note from "../../shared/linear-algebra.json";
import type { Row } from "../api";
import type {
  Kind,
  ResourceDetail,
  ResourceVersion,
} from "../features/resources/types";

export const subjectId = "algebra-lineal";
export const legacySubjectId = "circuitos";
export const exampleQuestion = "¿Por qué son dependientes (2, 1) y (4, 2)?";
export const exampleNoteId = "independencia-lineal";
export const exampleQuizId = "practica-vectores";
const exampleCardsId = "tarjetas-vectores";
const exampleSummaryId = "resumen-vectores";

export function canDeleteLocalResource(id: string) {
  return ![
    exampleQuizId,
    exampleCardsId,
    exampleSummaryId,
    "practica-ohm",
    "tarjetas-ohm",
    "resumen-ohm",
  ].includes(id);
}

export type VectorChallenge = {
  title: string;
  scenario: string;
  slope: number;
  targetY: number;
};
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
  topicIds: ["independencia"],
  blocks: [noteBlock],
};

export const practiceContent = {
  questions: [
    {
      prompt: "¿Cuál es el determinante de u = (2, 1) y v = (4, 2)?",
      options: ["−4", "0", "2", "4"],
      correctIndex: 1,
      explanation:
        "El determinante es 2 × 2 − 1 × 4 = 0. El vector v es el doble de u.",
    },
  ],
};
const contents: Partial<Record<Kind, ResourceVersion["content"]>> = {
  summary: {
    overview:
      "Dos vectores del plano son independientes si su determinante es distinto de cero.",
    sections: [
      {
        heading: "Un ejemplo",
        body: "Para u = (2, 1) y v = (4, 2), el determinante es cero porque v = 2u.",
      },
    ],
    keyPoints: [
      "El valor absoluto del determinante mide el área del paralelogramo.",
    ],
  },
  concepts: {
    concepts: [
      {
        term: "Determinante",
        definition: "Para u = (a, b) y v = (c, d), es ad − bc.",
      },
      {
        term: "Dependencia",
        definition:
          "Los dos vectores se alinean sobre la misma recta y su determinante es cero.",
      },
      {
        term: "Independencia",
        definition:
          "Los vectores no se alinean en una misma recta y su determinante es distinto de cero.",
      },
    ],
  },
  flashcards: {
    cards: [
      {
        front: "¿Qué significa que el determinante de dos vectores sea cero?",
        back: "Que son linealmente dependientes.",
      },
      {
        front: "¿Cómo obtienes el área del paralelogramo?",
        back: "Toma el valor absoluto del determinante.",
      },
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
  return content ? readyResource(id, kind, target, title, content) : null;
}

export function vectorResource(challenge: VectorChallenge): ResourceDetail {
  return readyResource(
    crypto.randomUUID(),
    "interactive",
    subjectId,
    challenge.title,
    { vectorChallenge: challenge },
    noteBlock.text,
  );
}

function readyResource(
  id: string,
  kind: Kind,
  target: string,
  title: string,
  content: unknown,
  quote?: string,
): ResourceDetail {
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
        instruction: "Repasar independencia lineal",
        status: "succeeded",
        stage: "succeeded",
        usageUnknown: false,
        jobId: "",
        content,
        citations: [{ ...noteBlock, quote }],
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
        name: "Álgebra lineal",
        periodId: "semestre",
        illustrationId: "vector",
        color: "blue",
        archived: false,
      },
    ],
    topics: [
      {
        id: "independencia",
        revision: 1,
        subjectId,
        title: note.title,
        prerequisiteIds: [],
      },
    ],
    agenda: [
      {
        id: "repaso-vectores",
        revision: 1,
        subjectId,
        title: "Repasar independencia lineal",
        status: "pending",
        dueDate,
        importance: "normal",
      },
    ],
    schedule: [
      {
        id: "clase-algebra",
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
    exampleEdition: "linear-algebra",
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
      sampleResource(exampleQuizId, "quiz", subjectId, "Práctica de vectores")!,
      sampleResource(
        exampleCardsId,
        "flashcards",
        subjectId,
        "Tarjetas de álgebra lineal",
      )!,
      sampleResource(
        exampleSummaryId,
        "summary",
        subjectId,
        "Independencia lineal en breve",
      )!,
    ],
    conversations: [] as Row[],
    turns: [] as Row[],
    attempts: [] as { versionId: string; score: number; total: number }[],
    reviews: {} as Record<string, Record<string, string>>,
  };
}
