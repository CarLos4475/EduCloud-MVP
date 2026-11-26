/** Placeholder shapes for waiting states; the text is for screen readers only. */
export function Skeleton({
  lines = 3,
  label,
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-block" role={label ? "status" : undefined}>
      {label && <span className="visually-hidden">{label}</span>}
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="skeleton-line"
          aria-hidden="true"
          style={{ width: `${92 - ((i * 17) % 40)}%` }}
        />
      ))}
    </div>
  );
}

const STEPS = ["Leyendo tus apuntes", "Armando tu recurso", "Revisando todo"];

/** Qué paso se muestra como activo según la etapa real del trabajo. */
function activeStep(stage: string, status: string) {
  if (status === "queued" || stage === "queued") return 0;
  if (stage === "repairing") return 2;
  if (stage === "receiving") return 1;
  return 0;
}

/** Espera con sentido: los pasos avanzan con el trabajo real y un bosquejo se va armando. */
export function StageProgress({
  stage,
  status,
  title,
}: {
  stage: string;
  status: string;
  title: string;
}) {
  const active = activeStep(stage, status);
  return (
    <div className="stage-progress" role="status" aria-live="polite">
      <strong className="stage-title">{title}</strong>
      <ol className="stage-steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index < active ? "done" : index === active ? "active" : ""
            }
          >
            <span className="stage-dot" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ol>
      <div className="stage-sketch" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <span className="skeleton-line skeleton-title" aria-hidden="true" />
      <Skeleton lines={2} />
      <div className="skeleton-cards" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-card resource-card">
            <Skeleton lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
