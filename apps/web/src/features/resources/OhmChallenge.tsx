import { useState } from "react";

type Challenge = { scenario: string; voltage: number; targetResistance: number };

const amperes = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function OhmChallenge({ challenge }: { challenge: Challenge }) {
  const { scenario, voltage, targetResistance } = challenge;
  const [resistance, setResistance] = useState(targetResistance === 6 ? 3 : 6);
  const current = voltage / resistance;
  const targetCurrent = voltage / targetResistance;
  const reached = resistance === targetResistance;

  return (
    <section className="study-challenge" aria-label="Simulación de la ley de Ohm">
      <div className="ohm-circuit">
        <p className="ohm-voltage">
          Voltaje fijo · <strong>{voltage} V</strong>
        </p>
        <div className="ohm-path" aria-hidden="true">
          <span
            className="ohm-flow"
            style={{
              opacity: Math.min(1, 0.38 + 1.4 / resistance),
              animationDuration: `${0.25 + resistance * 0.08}s`,
            }}
          />
        </div>
        <div className="ohm-current">
          <label htmlFor="ohm-current">Corriente actual</label>
          <output id="ohm-current" aria-live="off">
            {amperes.format(current)} <span>A</span>
          </output>
        </div>
      </div>
      <div className="challenge-controls">
        <p>{scenario}</p>
        <p>
          Ajusta la resistencia hasta llegar a{" "}
          <strong
            data-testid="ohm-goal"
            data-voltage={voltage}
            data-current={targetCurrent}
          >
            {amperes.format(targetCurrent)} A
          </strong>
          .
        </p>
        <div className="challenge-control-label">
          <label htmlFor="ohm-resistance">Resistencia</label>
          <span aria-hidden="true">{resistance} Ω</span>
        </div>
        <input
          id="ohm-resistance"
          type="range"
          min={1}
          max={20}
          step={1}
          value={resistance}
          aria-valuetext={`${resistance} ohmios`}
          onChange={(event) => setResistance(event.target.valueAsNumber)}
        />
        <div className="challenge-equation" role="status">
          {reached && <strong>¡Meta alcanzada!</strong>}
          <span>
            I = V / R · {voltage} V / {resistance} Ω
          </span>
        </div>
      </div>
    </section>
  );
}
