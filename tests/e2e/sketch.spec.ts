import { test, expect, Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Libreta de dibujo (EC.sketch): predecir dibujando, borrar, deshacer, revelar la curva
// real y una alternativa con botones. Usa el proveedor de prueba: no consume IA.
const shots = "test-results/sketch";

async function prepare(page: Page) {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Es mi primera visita" }).click();
  await page
    .getByLabel("Correo electrónico")
    .fill(`dibujo-${Date.now()}@pcpuma.acatlan.unam.mx`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-study-2026!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear mi primera materia" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Circuitos dibujo");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: /Circuitos dibujo.*temas/ }).click();
  await page.getByRole("tab", { name: "Apuntes" }).click();
  await page.getByLabel("Título de la nota").fill("Ley de Ohm");
  await page
    .getByLabel("Contenido de la nota")
    .fill("Ley de Ohm: V = I R. La resistencia se mide en ohmios.");
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await expect(
    page.getByText("Listo para estudiar", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
}

function sandbox(page: Page) {
  return page
    .frameLocator(".interactive iframe")
    .frameLocator("iframe.sandbox-frame");
}

async function drawAcross(
  page: Page,
  from: [number, number],
  to: [number, number],
) {
  const board = sandbox(page).locator(".ec-sketch-svg");
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error("No se encontró la libreta");
  await page.mouse.move(
    box.x + box.width * from[0],
    box.y + box.height * from[1],
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * ((from[0] + to[0]) / 2),
    box.y + box.height * ((from[1] + to[1]) / 2 - 0.1),
    { steps: 8 },
  );
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], {
    steps: 8,
  });
  await page.mouse.up();
}

test("dibujar una predicción, borrarla, deshacer, ver la real y elegir con botones", async ({
  page,
}) => {
  await mkdir(shots, { recursive: true });
  await prepare(page);
  await page.getByRole("tab", { name: "Recursos" }).click();
  await page.getByRole("button", { name: "+ Crear un recurso" }).click();
  const sheet = page.getByRole("dialog", { name: "¿Qué quieres crear?" });
  await sheet.getByText("Experimento interactivo", { exact: true }).click();
  await sheet
    .getByLabel(/algo en particular/i)
    .fill("Quiero que dibuje yo la gráfica");
  await sheet.getByRole("button", { name: "Crear", exact: true }).click();

  const frame = sandbox(page);
  await expect(frame.locator("body.ec-ready")).toBeVisible({ timeout: 60000 });
  const strokes = frame.locator(".ec-sketch-stroke");
  await expect(strokes).toHaveCount(0);
  await expect(frame.getByText("Dibuja cómo crees que cambia V")).toBeVisible();

  // Dibuja: el trazo aparece y la invitación se va.
  await drawAcross(page, [0.15, 0.8], [0.85, 0.25]);
  await expect(strokes).toHaveCount(1);
  await expect(frame.locator(".ec-sketch-hint")).toHaveCSS("opacity", "0");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/1-dibujo.png` });

  // Deshacer y rehacer.
  await frame.getByRole("button", { name: "Deshacer" }).click();
  await expect(strokes).toHaveCount(0);
  await frame.getByRole("button", { name: "Rehacer" }).click();
  await expect(strokes).toHaveCount(1);

  // El borrador quita el trazo por donde pasa.
  await frame.getByRole("button", { name: "Borrador" }).click();
  await drawAcross(page, [0.1, 0.85], [0.9, 0.2]);
  await expect(strokes).toHaveCount(0);
  await frame.getByRole("button", { name: "Lápiz" }).click();

  // Dibuja de nuevo y revela la curva real: aparece su etiqueta y no cambia el trazo.
  await drawAcross(page, [0.2, 0.75], [0.8, 0.3]);
  await expect(strokes).toHaveCount(1);
  await frame.getByRole("button", { name: "Ver la curva real" }).click();
  await expect(frame.locator(".ec-sketch-key")).toHaveText(/V = 5 I/);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/2-curva-real.png` });
  // Ocultarla quita la capa y su etiqueta; volver a mostrarla la trae de nuevo.
  await frame.getByRole("button", { name: "Ocultar la curva" }).click();
  await expect(frame.locator(".ec-sketch-key")).toHaveCount(0);
  await frame.getByRole("button", { name: "Ver la curva real" }).click();
  await expect(frame.locator(".ec-sketch-key")).toHaveCount(1);

  // Alternativa con botones para quien no dibuja.
  await frame.getByRole("button", { name: "Curva que se aplana" }).click();
  await expect(strokes).toHaveCount(1);
  await expect(
    frame.getByRole("button", { name: "Borrar todo" }),
  ).toBeEnabled();
  await frame.getByRole("button", { name: "Borrar todo" }).click();
  await expect(strokes).toHaveCount(0);
  await frame.getByRole("button", { name: "Recta que sube" }).click();
  await expect(strokes).toHaveCount(1);

  // El dibujo y lo revelado se conservan al recargar.
  await page.waitForTimeout(1500);
  await page.reload();
  const again = sandbox(page);
  await expect(again.locator("body.ec-ready")).toBeVisible({ timeout: 60000 });
  await expect(again.locator(".ec-sketch-stroke")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(again.locator(".ec-sketch-key")).toHaveText(/V = 5 I/);
});
