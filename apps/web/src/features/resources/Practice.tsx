import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { SafeMarkdown } from "../../components/SafeMarkdown";
import { Skeleton } from "../../components/Skeleton";

/* Práctica con ritmo: una cosa a la vez, rondas que vuelven sobre lo que falló,
   movimiento con sentido y un cierre claro. Todo respeta «reducir movimiento». */

export const calm = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración */
  }
}

export function shuffled(length: number, seed: number) {
  const items = Array.from({ length }, (_, i) => i);
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function useCountUp(target: number, ms = 800) {
  const [value, setValue] = useState(calm() ? target : 0);
  useEffect(() => {
    if (calm()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

export function Burst() {
  if (calm()) return null;
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2 + (i % 3) * 0.2;
        const distance = 90 + ((i * 37) % 110);
        return (
          <i
            key={i}
            style={
              {
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance - 30}px`,
                "--rot": `${(i * 53) % 360}deg`,
                "--c": ["#b59957", "#122245", "#2f7f86", "#b4552d", "#6a5a9a"][
                  i % 5
                ],
                animationDelay: `${(i % 6) * 25}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

export function Check() {
  return (
    <svg className="check-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" pathLength={1} />
    </svg>
  );
}

export function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className="practice-stat">
      <b>{shown}</b>
      <small>{label}</small>
    </div>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="practice-bar" aria-hidden="true">
      <i
        style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }}
      />
    </div>
  );
}

/* ---------- tarjetas ---------- */

type Card = { front: string; back: string };

export function Flashcards({
  content,
  versionId,
}: {
  content: { cards: Card[] };
  versionId: string;
}) {
  const cards = content.cards;
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState<"known" | "again" | null>(null);
  const [retry, setRetry] = useState<number[]>([]);
  const [knownNow, setKnownNow] = useState(0);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    const seed = Date.now();
    const start = (saved: Record<string, string>) => {
      if (!alive) return;
      setMarks(saved);
      // Primero lo que quedó por repasar, luego lo nuevo y al final lo que ya sabías.
      const rank = (i: number) =>
        saved[String(i)] === "again" ? 0 : saved[String(i)] === "known" ? 2 : 1;
      const order = shuffled(cards.length, seed).sort(
        (a, b) => rank(a) - rank(b),
      );
      setQueue(order);
    };
    api<{ cards: Record<string, string> }>(
      `/resources/versions/${versionId}/review`,
    )
      .then((review) => start(review.cards))
      .catch(() => start({}));
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [versionId, cards.length]);

  const save = (next: Record<string, string>) =>
    api(`/resources/versions/${versionId}/review`, {
      method: "PUT",
      body: JSON.stringify({ cards: next }),
    })
      .then(() => setNote(""))
      .catch(() => setNote("No pudimos guardar tu repaso. Intenta de nuevo."));

  const rate = useCallback(
    (value: "known" | "again") => {
      if (leaving || !queue || pos >= queue.length) return;
      const index = queue[pos];
      const next = { ...marks, [String(index)]: value };
      setMarks(next);
      void save(next);
      setLeaving(value);
      buzz(value === "known" ? 10 : [16, 40, 16]);
      timer.current = setTimeout(
        () => {
          setLeaving(null);
          setFlipped(false);
          if (value === "again") setRetry((r) => [...r, index]);
          else setKnownNow((k) => k + 1);
          setPos((p) => p + 1);
        },
        calm() ? 0 : 430,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leaving, queue, pos, marks, versionId],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || !flipped) return;
      if (event.key === "ArrowLeft" || event.key === "1") rate("again");
      if (event.key === "ArrowRight" || event.key === "2") rate("known");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate]);

  if (!queue)
    return (
      <div className="practice">
        <Skeleton lines={4} label="Preparando tus tarjetas" />
      </div>
    );

  const known = Object.values(marks).filter((v) => v === "known").length;
  const again = Object.values(marks).filter((v) => v === "again").length;

  if (pos >= queue.length) {
    const finished = retry.length === 0;
    return (
      <div className="practice practice-summary">
        {finished && <Burst />}
        <small className="practice-kicker">Ronda {round} completada</small>
        <h3>
          {finished
            ? "Mazo completado."
            : retry.length === 1
              ? "Queda una. Vamos por ella."
              : `Quedan ${retry.length}. Vamos por ellas.`}
        </h3>
        <div className="practice-stats">
          <Stat value={knownNow} label="La sabías" />
          <Stat value={retry.length} label="Por repasar" />
          <Stat value={cards.length} label="En el mazo" />
        </div>
        <p role="status" className="flash-count">
          Tarjeta {cards.length} de {cards.length} · Sabidas: {known} · Por
          repasar: {again}
        </p>
        <div className="button-row">
          {!finished && (
            <button
              className="primary"
              onClick={() => {
                setQueue(
                  shuffled(retry.length, Date.now()).map((i) => retry[i]),
                );
                setRetry([]);
                setKnownNow(0);
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
              setQueue(shuffled(cards.length, Date.now()));
              setRetry([]);
              setKnownNow(0);
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

  const card = cards[queue[pos]];
  return (
    <div className="practice flashcards">
      <div className="practice-head">
        <p role="status" className="flash-count">
          Tarjeta {pos + 1} de {queue.length} · Sabidas: {known} · Por repasar:{" "}
          {again}
        </p>
        {round > 1 && <span className="practice-round">Ronda {round}</span>}
      </div>
      <ProgressBar done={pos} total={queue.length} />
      <div className={`deck ${leaving ? `leaving-${leaving}` : ""}`}>
        <span className="deck-back deck-back-2" aria-hidden="true" />
        <span className="deck-back deck-back-1" aria-hidden="true" />
        <div
          key={`${round}-${queue[pos]}`}
          className={`flip-card ${flipped ? "flipped" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Ver la pregunta" : "Ver la respuesta"}
          onClick={() => !leaving && setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              if (!leaving) setFlipped((f) => !f);
            }
          }}
        >
          <span className="flip-inner">
            <span className="flip-face flip-front">
              <small>Pregunta</small>
              <SafeMarkdown text={card.front} />
              <span className="flash-hint">Toca para voltear</span>
            </span>
            <span className="flip-face flip-back">
              <small>Respuesta</small>
              <SafeMarkdown text={card.back} />
              <span className="flash-hint">Toca para volver</span>
            </span>
          </span>
        </div>
      </div>
      <div className={`rate-row ${flipped ? "show" : ""}`}>
        <button
          className="secondary"
          disabled={!flipped || Boolean(leaving)}
          tabIndex={flipped ? 0 : -1}
          onClick={() => rate("again")}
        >
          Repasar otra vez
        </button>
        <button
          className="primary"
          disabled={!flipped || Boolean(leaving)}
          tabIndex={flipped ? 0 : -1}
          onClick={() => rate("known")}
        >
          La sabía
        </button>
      </div>
      <p className="practice-keys" aria-hidden="true">
        Espacio voltea · ← repasar · → la sabía
      </p>
      {note && (
        <p role="alert" className="form-error">
          {note}
        </p>
      )}
    </div>
  );
}

/* ---------- cuestionario ---------- */

type Question = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export function Quiz({
  content,
  versionId,
  onProgress,
}: {
  content: { questions: Question[] };
  versionId: string;
  onProgress?: () => void;
}) {
  const questions = content.questions;
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(1);
  const [order, setOrder] = useState<number[]>(() =>
    questions.map((_, i) => i),
  );
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [first, setFirst] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [missed, setMissed] = useState<number[]>([]);
  const [saved, setSaved] = useState<{ score: number; total: number } | null>(
    null,
  );
  const [problem, setProblem] = useState("");
  const [shake, setShake] = useState(false);

  const q = order[pos];
  const perm = useMemo(
    () =>
      q === undefined
        ? []
        : shuffled(
            questions[q].options.length,
            q * 131 + round * 17 + attempt * 7 + 3,
          ),
    [q, round, attempt, questions],
  );
  const finished = pos >= order.length;

  useEffect(() => {
    if (!finished || round !== 1 || saved || problem) return;
    if (first.some((a) => a === null)) return;
    api<{ score: number; total: number }>(
      `/resources/versions/${versionId}/attempts`,
      { method: "POST", body: JSON.stringify({ answers: first }) },
    )
      .then(setSaved)
      .catch(() => setProblem("No pudimos guardar este intento."));
  }, [finished, round, saved, problem, first, versionId]);

  const pick = useCallback(
    (display: number) => {
      if (picked !== null || finished) return;
      const original = perm[display];
      const ok = original === questions[q].correctIndex;
      setPicked(original);
      if (round === 1)
        setFirst((answers) => answers.map((a, i) => (i === q ? original : a)));
      if (!ok) {
        setMissed((m) => (m.includes(q) ? m : [...m, q]));
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
      buzz(ok ? 12 : [18, 40, 18]);
    },
    [picked, finished, perm, questions, q, round],
  );

  const next = useCallback(() => {
    setPicked(null);
    setPos((p) => p + 1);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || finished) return;
      const number = Number(event.key);
      if (picked === null && number >= 1 && number <= perm.length)
        pick(number - 1);
      else if (
        picked !== null &&
        (event.key === "Enter" || event.key === "ArrowRight")
      ) {
        if ((event.target as HTMLElement).tagName !== "BUTTON") next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, finished, perm.length, pick, next]);

  const total = questions.length;
  const scoreNow = saved ? saved.score : 0;
  const shownScore = useCountUp(finished && round === 1 ? scoreNow : 0);

  if (finished) {
    const failed = missed.filter((i) => order.includes(i));
    const perfect = round === 1 && saved && saved.score === saved.total;
    return (
      <div className="practice practice-summary">
        {perfect && <Burst />}
        <small className="practice-kicker">
          {round === 1 ? "Tu resultado" : `Ronda ${round} completada`}
        </small>
        {round === 1 ? (
          <>
            <h3 className="quiz-bigscore">
              <b>{shownScore}</b>
              <span> de {total}</span>
            </h3>
            <p role="status" className="quiz-score">
              {saved
                ? `Acertaste ${saved.score} de ${saved.total}. Quedó guardado en tu progreso.`
                : problem || "Guardando tu resultado…"}
            </p>
          </>
        ) : (
          <h3>
            {failed.length
              ? `Aún te falta${failed.length === 1 ? "" : "n"} ${failed.length}.`
              : "Ya dominas todas las que fallaste."}
          </h3>
        )}
        <div className="button-row">
          {onProgress && saved && (
            <button className="primary" onClick={onProgress}>
              Ver tu progreso
            </button>
          )}
          {!onProgress && failed.length > 0 && (
            <button
              className="primary"
              onClick={() => {
                setOrder(failed);
                setMissed([]);
                setPos(0);
                setPicked(null);
                setRound((r) => r + 1);
              }}
            >
              Repasar{" "}
              {failed.length === 1
                ? "la que fallé"
                : `las ${failed.length} que fallé`}
            </button>
          )}
          <button
            className={onProgress || failed.length ? "secondary" : "primary"}
            onClick={() => {
              setAttempt((a) => a + 1);
              setRound(1);
              setOrder(questions.map((_, i) => i));
              setPos(0);
              setPicked(null);
              setFirst(questions.map(() => null));
              setMissed([]);
              setSaved(null);
              setProblem("");
            }}
          >
            Intentarlo otra vez
          </button>
        </div>
      </div>
    );
  }

  const question = questions[q];
  const last = pos === order.length - 1;
  const correct = picked === question.correctIndex;
  return (
    <div className="practice quiz-session">
      <div className="practice-head">
        <p role="status">
          Pregunta {pos + 1} de {order.length}
        </p>
        {round > 1 && <span className="practice-round">Ronda {round}</span>}
      </div>
      <ProgressBar done={pos} total={order.length} />
      <div
        key={`${attempt}-${round}-${q}`}
        className="quiz-card practice-enter"
      >
        <div className="quiz-prompt">
          <SafeMarkdown text={question.prompt} />
        </div>
        <div
          className={`quiz-options ${shake ? "shake" : ""}`}
          role="group"
          aria-label="Elige una respuesta"
        >
          {perm.map((original, display) => {
            const state =
              picked === null
                ? ""
                : original === question.correctIndex
                  ? "right"
                  : picked === original
                    ? "wrong"
                    : "dim";
            return (
              <button
                key={original}
                className={`quiz-option ${state}`}
                disabled={picked !== null}
                onClick={() => pick(display)}
              >
                <span className="quiz-letter" aria-hidden="true">
                  {"ABCDE"[display]}
                </span>
                <span className="quiz-text">
                  <SafeMarkdown text={question.options[original]} />
                </span>
                {state === "right" && <Check />}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div
            role="status"
            className={`quiz-feedback practice-pop ${correct ? "good" : "bad"}`}
          >
            <strong>{correct ? "¡Bien!" : "Casi."}</strong>
            <SafeMarkdown text={question.explanation} />
          </div>
        )}
        {picked !== null && (
          <button className="primary" onClick={next}>
            {last ? "Ver mi resultado" : "Continuar"}
          </button>
        )}
        <p className="practice-keys" aria-hidden="true">
          Teclas 1 a {question.options.length} para elegir · Enter continúa
        </p>
      </div>
    </div>
  );
}
