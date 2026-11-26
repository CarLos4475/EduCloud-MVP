import { useEffect, useRef, useState } from "react";
import type { VectorChallenge as Challenge } from "../../mvp/fixtures";

const size = 320;
const origin = { x: 96, y: 158 };
const unit = 19;
const blue = "#b2d6ff";
const gold = "#f0cb72";

type Point = { x: number; y: number };

function drawArrow(
  context: CanvasRenderingContext2D,
  point: Point,
  color: string,
  label: string,
  labelY: number,
) {
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  context.beginPath();
  context.moveTo(point.x, point.y);
  for (const offset of [-0.55, 0.55]) {
    context.lineTo(
      point.x - 10 * Math.cos(angle + offset),
      point.y - 10 * Math.sin(angle + offset),
    );
  }
  context.fill();
  context.fillText(label, point.x + 9, point.y + labelY);
}

export function VectorChallenge({ challenge }: { challenge: Challenge }) {
  const { scenario, slope, targetY } = challenge;
  const [vertical, setVertical] = useState(2 * slope);
  const determinant = 2 * vertical - 4 * slope;
  const target = 2 * targetY - 4 * slope;
  const plot = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = plot.current?.getContext("2d");
    if (!context) return;
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.clearRect(0, 0, size, size);
    context.lineWidth = 1;
    context.strokeStyle = "#ffffff20";
    context.beginPath();
    for (let x = origin.x % unit; x < size; x += unit) {
      context.moveTo(x, 0);
      context.lineTo(x, size);
    }
    for (let y = origin.y % unit; y < size; y += unit) {
      context.moveTo(0, y);
      context.lineTo(size, y);
    }
    context.stroke();
    context.strokeStyle = "#ffffff86";
    context.beginPath();
    context.moveTo(0, origin.y);
    context.lineTo(size, origin.y);
    context.moveTo(origin.x, 0);
    context.lineTo(origin.x, size);
    context.stroke();
    context.font = "bold 14px system-ui";
    context.fillStyle = "#ffffffbd";
    context.fillText("x", size - 16, origin.y - 8);
    context.fillText("y", origin.x + 7, 16);

    const u = { x: origin.x + 2 * unit, y: origin.y - slope * unit };
    const v = { x: origin.x + 4 * unit, y: origin.y - vertical * unit };
    context.fillStyle = vertical === targetY ? "#f0cb7266" : "#f0cb7230";
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(u.x, u.y);
    context.lineTo(u.x + v.x - origin.x, u.y + v.y - origin.y);
    context.lineTo(v.x, v.y);
    context.closePath();
    context.fill();
    drawArrow(context, v, gold, "v", 17);
    drawArrow(context, u, blue, "u", -9);
  }, [slope, targetY, vertical]);

  return (
    <section
      className="study-challenge"
      aria-label="Simulación de independencia lineal"
    >
      <div className="vector-plot">
        <canvas
          ref={plot}
          width={size * 2}
          height={size * 2}
          aria-hidden="true"
        />
        <p className="vector-legend">
          <span>u = (2, {slope})</span>
          <span>v = (4, {vertical})</span>
        </p>
      </div>
      <div className="challenge-controls">
        <p>{scenario}</p>
        <p>
          Mueve el vector <b>v</b> hasta obtener un determinante de{" "}
          <strong
            data-testid="vector-goal"
            data-slope={slope}
            data-determinant={target}
          >
            {target}
          </strong>
          .
        </p>
        <div className="challenge-control-label">
          <label htmlFor="vertical-coordinate">Componente y del vector v</label>
          <span aria-hidden="true">{vertical}</span>
        </div>
        <input
          id="vertical-coordinate"
          type="range"
          min={-5}
          max={5}
          value={vertical}
          onChange={(event) => setVertical(event.target.valueAsNumber)}
        />
        <div className="challenge-equation" role="status">
          <span>
            Determinante = <b>{determinant}</b>
          </span>
          <span>
            {determinant === 0
              ? "Vectores dependientes"
              : "Vectores independientes"}
          </span>
          {vertical === targetY && <strong>¡Meta alcanzada!</strong>}
        </div>
      </div>
    </section>
  );
}
