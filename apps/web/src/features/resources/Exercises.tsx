import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { SafeMarkdown } from "../../components/SafeMarkdown";
import { Skeleton } from "../../components/Skeleton";
import { Burst, Check, ProgressBar, Stat, buzz, shuffled } from "./Practice";

/* Ejercicios y conexiones: practicar resolviendo, con pistas graduales, rondas de repaso
   y retroalimentación inmediata. Lo que cuesta se guarda como «por repasar». */

type Exercise = {
  type: "open" | "complete" | "order";
  prompt: string;
  answer: string;
  steps: string[];
  hints: string[];
  explanation: string;
};
type Pair = { left: string; right: string; why: string };
type Marks = Record<string, "known" | "again">;

const plain = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,/+*^=-]/g, "")
    .replace(/(es|s)$/, "");

function useMarks(versionId: string) {
  const [marks, setMarks] = useState<Marks | null>(null);
  const [note, setNote] = useState("");
  const current = useRef<Marks>({});
  useEffect(() => {
    let alive = true;
    api<{ cards: Marks }>(`/resources/versions/${versionId}/review`)
      .then((review) => {
        current.current = review.cards;
        if (alive) setMarks(review.cards);
      })
      .catch(() => alive && setMarks({}));
    return () => {
      alive = false;
    };
  }, [versionId]);
  const save = (index: number, value: "known" | "again") => {
    current.current = { ...current.current, [String(index)]: value };
    setMarks(current.current);
    api(`/resources/versions/${versionId}/review`, {
      method: "PUT",
      body: JSON.stringify({ cards: current.current }),
    })
      .then(() => setNote(""))
      .catch(() => setNote("No pudimos guardar tu avance. Intenta de nuevo."));
  };
  return { marks, save, note };
}

/* ---------- ejercicios ---------- */

export function Exercises({
  content,
  versionId,
}: {
  content: { exercises: Exercise[] };
  versionId: string;
}) {
  const items = content.exercises;
  const { marks, save, note } = useMarks(versionId);
  const [queue, setQueue] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [retry, setRetry] = useState<number[]>([]);
  const [clean, setClean] = useState(0);

  useEffect(() => {
    if (!marks || queue) return;
    const rank = (i: number) =>
      marks[String(i)] === "again" ? 0 : marks[String(i)] === "known" ? 2 : 1;
    setQueue(
      shuffled(items.length, Date.now()).sort((a, b) => rank(a) - rank(b)),
    );
  }, [marks, queue, items.length]);

  if (!queue)
    return (
      <div className="practice">
        <Skeleton lines={4} label="Preparando tus ejercicios" />
      </div>
    );

  const done = (index: number, helped: boolean) => {
    save(index, helped ? "again" : "known");
    if (helped) setRetry((r) => (r.includes(index) ? r : [...r, index]));
    else setClean((c) => c + 1);
    setPos((p) => p + 1);
  };

  if (pos >= queue.length) {
    const finished = retry.length === 0;
    return (
      <div className="practice practice-summary">
        {finished && <Burst />}
        <small className="practice-kicker">Ronda {round} completada</small>
        <h3>
          {finished
            ? "Todo resuelto."
            : retry.length === 1
              ? "Queda un ejercicio. Vamos por él."
              : `Quedan ${retry.length}. Vamos por ellos.`}
        </h3>
        <div className="practice-stats">
          <Stat value={clean} label="Sin ayuda" />
          <Stat value={retry.length} label="Por repasar" />
        </div>
        <div className="button-row">
          {!finished && (
            <button
              className="primary"
              onClick={() => {
                setQueue(
                  shuffled(retry.length, Date.now()).map((i) => retry[i]),
                );
                setRetry([]);
                setClean(0);
                setPos(0);
                setRound((r) => r + 1);
              }}
            >
              Siguiente ronda ({retry.length})
            </button>
          )}
          <button
            className={finished ? "primary" : "secondary"}
            onClick={() => {
              setQueue(shuffled(items.length, Date.now()));
              setRetry([]);
              setClean(0);
              setPos(0);
              setRound(1);
            }}
          >
            Empezar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const index = queue[pos];
  return (
    <div className="practice exercise-session">
      <div className="practice-head">
        <p role="status">
          Ejercicio {pos + 1} de {queue.length}
        </p>
        {round > 1 && <span className="practice-round">Ronda {round}</span>}
      </div>
      <ProgressBar done={pos} total={queue.length} />
      <ExerciseCard
        key={`${round}-${index}`}
        exercise={items[index]}
        onDone={(helped) => done(index, helped)}
        last={pos === queue.length - 1}
      />
      {note && (
        <p role="alert" className="form-error">
          {note}
        </p>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  onDone,
  last,
}: {
  exercise: Exercise;
  onDone: (helped: boolean) => void;
  last: boolean;
}) {
  const [hints, setHints] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [shake, setShake] = useState(false);
  const [text, setText] = useState("");
  const [written, setWritten] = useState("");
  const initial = useMemo(() => {
    const base = exercise.steps.map((_, i) => i);
    if (exercise.type !== "order") return base;
    let order = shuffled(base.length, Date.now() % 9973);
    if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];
    return order;
  }, [exercise]);
  const [order, setOrder] = useState<number[]>(initial);
  const [wrongAt, setWrongAt] = useState<number[]>([]);

  const helped = hints > 0 || revealed || tries > 0;
  const finish = solved || revealed;
  const bad = () => {
    setTries((t) => t + 1);
    setShake(true);
    buzz([16, 40, 16]);
    setTimeout(() => setShake(false), 450);
  };
  const win = () => {
    setSolved(true);
    buzz(12);
  };

  const checkComplete = () => {
    if (plain(text) === plain(exercise.answer)) win();
    else bad();
  };
  const checkOrder = () => {
    const wrong = order.map((v, i) => (v === i ? -1 : i)).filter((i) => i >= 0);
    setWrongAt(wrong);
    if (!wrong.length) win();
    else bad();
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || solved) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
    setWrongAt([]);
  };

  const parts = exercise.prompt.split("___");
  return (
    <div className="quiz-card practice-enter">
      <span className="exercise-type">
        {exercise.type === "open"
          ? "Resuelve"
          : exercise.type === "complete"
            ? "Completa"
            : "Ordena"}
      </span>
      {exercise.type === "complete" ? (
        <div className="quiz-prompt exercise-fill">
          <SafeMarkdown text={parts[0]} />
          <input
            aria-label="Tu respuesta"
            className={`fill-input ${solved ? "right" : shake ? "wrong" : ""}`}
            value={solved ? exercise.answer : text}
            disabled={solved || revealed}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !finish && checkComplete()}
            autoComplete="off"
          />
          <SafeMarkdown text={parts.slice(1).join("___")} />
        </div>
      ) : (
        <div className="quiz-prompt">
          <SafeMarkdown text={exercise.prompt} />
        </div>
      )}

      {exercise.type === "open" && (
        <label className="exercise-write">
          Tu resolución (opcional)
          <textarea
            rows={3}
            value={written}
            disabled={finish}
            onChange={(e) => setWritten(e.target.value)}
            placeholder="Escribe aquí tus pasos…"
          />
        </label>
      )}

      {exercise.type === "order" && (
        <ol className={`order-list ${shake ? "shake" : ""}`}>
          {order.map((stepIndex, i) => (
            <li
              key={stepIndex}
              className={solved ? "right" : wrongAt.includes(i) ? "wrong" : ""}
            >
              <span className="quiz-letter" aria-hidden="true">
                {i + 1}
              </span>
              <span className="quiz-text">
                <SafeMarkdown text={exercise.steps[stepIndex]} />
              </span>
              {!solved && (
                <span className="order-move">
                  <button
                    type="button"
                    className="alt"
                    aria-label={`Subir paso ${i + 1}`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="alt"
                    aria-label={`Bajar paso ${i + 1}`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    ↓
                  </button>
                </span>
              )}
              {solved && <Check />}
            </li>
          ))}
        </ol>
      )}

      {hints > 0 &&
        exercise.hints.slice(0, hints).map((hint, i) => (
          <div key={i} className="exercise-hint practice-pop" role="note">
            <strong>Pista {i + 1}</strong>
            <SafeMarkdown text={hint} />
          </div>
        ))}

      {tries > 0 && !finish && (
        <p role="status" className="exercise-miss">
          {exercise.type === "order"
            ? "Todavía hay pasos fuera de lugar."
            : "Todavía no. Revisa la pista o inténtalo otra vez."}
        </p>
      )}

      {finish && (
        <div
          role="status"
          className={`quiz-feedback practice-pop ${solved ? "good" : "bad"}`}
        >
          <strong>{solved ? "¡Bien!" : "Así se resuelve"}</strong>
          {exercise.type === "open" && revealed && (
            <SafeMarkdown text={exercise.answer} />
          )}
          {exercise.type === "complete" && revealed && !solved && (
            <SafeMarkdown text={`Respuesta: **${exercise.answer}**`} />
          )}
          {exercise.type === "order" && revealed && !solved && (
            <ol>
              {exercise.steps.map((step, i) => (
                <li key={i}>
                  <SafeMarkdown text={step} />
                </li>
              ))}
            </ol>
          )}
          <SafeMarkdown text={exercise.explanation} />
        </div>
      )}

      <div className="button-row">
        {!finish && exercise.type === "complete" && (
          <button
            className="primary"
            onClick={checkComplete}
            disabled={!text.trim()}
          >
            Comprobar
          </button>
        )}
        {!finish && exercise.type === "order" && (
          <button className="primary" onClick={checkOrder}>
            Comprobar
          </button>
        )}
        {!finish && hints < exercise.hints.length && (
          <button className="secondary" onClick={() => setHints((h) => h + 1)}>
            {hints === 0 ? "Quiero una pista" : "Otra pista"}
          </button>
        )}
        {!finish &&
          (exercise.type === "open" ||
            tries >= 2 ||
            hints >= exercise.hints.length) && (
            <button className="secondary" onClick={() => setRevealed(true)}>
              {exercise.type === "open"
                ? "Ver la solución"
                : "Mostrar la respuesta"}
            </button>
          )}
        {finish && exercise.type === "open" && revealed && (
          <>
            <button className="secondary" onClick={() => onDone(true)}>
              Necesito repasarlo
            </button>
            <button className="primary" onClick={() => onDone(hints > 0)}>
              Lo resolví
            </button>
          </>
        )}
        {finish && !(exercise.type === "open" && revealed) && (
          <button className="primary" onClick={() => onDone(helped)}>
            {last ? "Ver mi resultado" : "Continuar"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- conexiones ---------- */

const LINK_COLORS = [
  "#122245",
  "#b4552d",
  "#2f7f86",
  "#6a5a9a",
  "#4d7c4a",
  "#b59957",
];

export function Connections({
  content,
  versionId,
}: {
  content: { pairs: Pair[] };
  versionId: string;
}) {
  const pairs = content.pairs;
  const { marks, save, note } = useMarks(versionId);
  const [attempt, setAttempt] = useState(0);
  const rightOrder = useMemo(
    () => shuffled(pairs.length, 17 + attempt * 31),
    [pairs.length, attempt],
  );
  const [links, setLinks] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [checks, setChecks] = useState(0);
  const firstTry = useRef<Record<number, boolean>>({});

  const complete = locked.length === pairs.length;
  const free = pairs.map((_, i) => i).filter((i) => !locked.includes(i));
  const linkedAll = free.every((i) => links[i] !== undefined);

  if (!marks)
    return (
      <div className="practice">
        <Skeleton lines={4} label="Preparando tus conexiones" />
      </div>
    );

  const pickLeft = (i: number) => {
    if (locked.includes(i)) return;
    if (links[i] !== undefined) {
      const next = { ...links };
      delete next[i];
      setLinks(next);
      setSelected(i);
      return;
    }
    setSelected(i === selected ? null : i);
  };
  const pickRight = (right: number) => {
    if (
      Object.entries(links).some(
        ([l, r]) => r === right && locked.includes(Number(l)),
      )
    )
      return;
    if (selected === null) {
      // Tocar una relación ya unida la suelta para volver a elegir.
      const owner = Object.entries(links).find(([, r]) => r === right);
      if (owner) {
        const next = { ...links };
        delete next[Number(owner[0])];
        setLinks(next);
        setSelected(Number(owner[0]));
      }
      return;
    }
    const next = { ...links };
    for (const l of Object.keys(next))
      if (next[Number(l)] === right) delete next[Number(l)];
    next[selected] = right;
    setLinks(next);
    setSelected(null);
    buzz(8);
  };
  const verify = () => {
    const ok = free.filter((i) => links[i] === i);
    const wrong = free.filter((i) => links[i] !== i);
    for (const i of free)
      if (firstTry.current[i] === undefined)
        firstTry.current[i] = checks === 0 && links[i] === i;
    setChecks((c) => c + 1);
    setLocked((l) => [...l, ...ok]);
    if (wrong.length) {
      const next = { ...links };
      wrong.forEach((i) => delete next[i]);
      setLinks(next);
      setShake(true);
      buzz([16, 40, 16]);
      setTimeout(() => setShake(false), 450);
    } else {
      buzz(12);
    }
    const nowComplete = ok.length + locked.length === pairs.length;
    if (nowComplete) {
      pairs.forEach((_, i) => save(i, firstTry.current[i] ? "known" : "again"));
    }
  };

  const perfect = complete && pairs.every((_, i) => firstTry.current[i]);
  return (
    <div className="practice connections-session">
      <div className="practice-head">
        <p role="status">
          {complete
            ? "Todas unidas"
            : `${locked.length} de ${pairs.length} unidas`}
        </p>
        {checks > 0 && !complete && (
          <span className="practice-round">Comprobaciones: {checks}</span>
        )}
      </div>
      <ProgressBar done={locked.length} total={pairs.length} />
      {!complete && (
        <p className="exercise-miss">
          Toca un concepto y después su relación. Toca una unión para soltarla.
        </p>
      )}
      <div className={`connect-grid ${shake ? "shake" : ""}`}>
        <ul aria-label="Conceptos">
          {pairs.map((pair, i) => {
            const linked = links[i] !== undefined;
            const color = LINK_COLORS[i % LINK_COLORS.length];
            return (
              <li key={i}>
                <button
                  className={`connect-item ${locked.includes(i) ? "right" : ""} ${selected === i ? "picked" : ""} ${linked ? "linked" : ""}`}
                  style={{ "--link": color } as React.CSSProperties}
                  aria-pressed={selected === i}
                  onClick={() => pickLeft(i)}
                >
                  <span className="connect-dot" aria-hidden="true">
                    {locked.includes(i) ? <Check /> : linked ? i + 1 : ""}
                  </span>
                  <span className="quiz-text">
                    <SafeMarkdown text={pair.left} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul aria-label="Relaciones">
          {rightOrder.map((r) => {
            const owner = Object.entries(links).find(([, v]) => v === r);
            const ownerIndex = owner ? Number(owner[0]) : null;
            const color =
              ownerIndex !== null
                ? LINK_COLORS[ownerIndex % LINK_COLORS.length]
                : "#122245";
            const isLocked = ownerIndex !== null && locked.includes(ownerIndex);
            return (
              <li key={r}>
                <button
                  className={`connect-item ${isLocked ? "right" : ""} ${ownerIndex !== null ? "linked" : ""}`}
                  style={{ "--link": color } as React.CSSProperties}
                  onClick={() => pickRight(r)}
                  disabled={isLocked}
                >
                  <span className="connect-dot" aria-hidden="true">
                    {isLocked ? (
                      <Check />
                    ) : ownerIndex !== null ? (
                      ownerIndex + 1
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="quiz-text">
                    <SafeMarkdown text={pairs[r].right} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {!complete && (
        <div className="button-row">
          <button
            className="primary"
            disabled={!linkedAll || !free.length}
            onClick={verify}
          >
            Comprobar
          </button>
        </div>
      )}
      {complete && (
        <div className="practice-summary practice-pop">
          {perfect && <Burst />}
          <small className="practice-kicker">Resultado</small>
          <h3>{perfect ? "Todas a la primera." : "Lo lograste."}</h3>
          <div className="practice-stats">
            <Stat
              value={Object.values(firstTry.current).filter(Boolean).length}
              label="A la primera"
            />
            <Stat value={checks} label="Comprobaciones" />
          </div>
          <ul className="why-list">
            {pairs.map((pair, i) => (
              <li key={i}>
                <strong>
                  <SafeMarkdown text={`${pair.left} → ${pair.right}`} />
                </strong>
                <SafeMarkdown text={pair.why} />
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button
              className="primary"
              onClick={() => {
                setAttempt((a) => a + 1);
                setLinks({});
                setLocked([]);
                setSelected(null);
                setChecks(0);
                firstTry.current = {};
              }}
            >
              Jugar otra vez
            </button>
          </div>
        </div>
      )}
      {note && (
        <p role="alert" className="form-error">
          {note}
        </p>
      )}
    </div>
  );
}
