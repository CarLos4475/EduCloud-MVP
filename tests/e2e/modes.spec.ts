import { test, expect, Page } from "@playwright/test";

// Ejercicios y conexiones con el proveedor configurado (IA real o proveedor de prueba).
async function prepare(page: Page) {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Es mi primera visita" }).click();
  await page
    .getByLabel("Correo electrónico")
    .fill(`modos-${Date.now()}@pcpuma.acatlan.unam.mx`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-study-2026!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear mi primera materia" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Circuitos modos");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: /Circuitos modos.*temas/ }).click();
  await page.getByRole("tab", { name: "Apuntes" }).click();
  await page.getByLabel("Título de la nota").fill("Ley de Ohm");
  await page
    .getByLabel("Contenido de la nota")
    .fill(
      "Ley de Ohm: V = I R. La resistencia se mide en ohmios. " +
        "Si la resistencia aumenta y el voltaje es fijo, la corriente disminuye. " +
        "La potencia disipada en una resistencia es P = V I = I^2 R.",
    );
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await expect(
    page.getByText("Listo para estudiar", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
}

async function create(page: Page, kind: string) {
  await page.getByRole("tab", { name: "Recursos" }).click();
  await page.getByRole("button", { name: "+ Crear un recurso" }).click();
  const sheet = page.getByRole("dialog", { name: "¿Qué quieres crear?" });
  await sheet.getByText(kind, { exact: true }).click();
  await sheet.getByRole("button", { name: "Crear", exact: true }).click();
}

test("ejercicios: pistas, solución y cierre de ronda", async ({ page }) => {
  test.setTimeout(300000);
  await prepare(page);
  await create(page, "Ejercicios");
  await expect(page.getByText(/Ejercicio 1 de/)).toBeVisible({
    timeout: 150000,
  });
  const total = Number(
    (await page.getByText(/Ejercicio 1 de \d+/).innerText()).match(
      /de (\d+)/,
    )![1],
  );
  for (let i = 0; i < total; i++) {
    await page.getByRole("button", { name: /pista/i }).first().click();
    await expect(page.locator(".exercise-hint")).toBeVisible();
    const reveal = page.getByRole("button", {
      name: /Ver la solución|Mostrar la respuesta/,
    });
    for (let tries = 0; tries < 3 && !(await reveal.count()); tries++) {
      // Completar y ordenar muestran la respuesta tras un par de intentos.
      const check = page.getByRole("button", { name: "Comprobar" });
      if (await check.count()) {
        const input = page.getByLabel("Tu respuesta");
        if (await input.count()) await input.fill("x" + tries);
        await check.click();
      }
    }
    await reveal.click();
    const next = page.getByRole("button", {
      name: /Lo resolví|Continuar|Ver mi resultado/,
    });
    await next.first().click();
  }
  await expect(page.getByText(/Ronda 1 completada/)).toBeVisible();
});

test("conexiones: unir, comprobar y ver el porqué", async ({ page }) => {
  test.setTimeout(300000);
  await prepare(page);
  await create(page, "Conexiones");
  await expect(page.locator(".connect-grid")).toBeVisible({ timeout: 150000 });
  const left = page.locator(".connect-grid ul").nth(0).locator("button");
  const right = page.locator(".connect-grid ul").nth(1).locator("button");
  const n = await left.count();
  expect(n).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeDisabled();
  // Con N pares, probar rotaciones hasta acertar todas (siempre existe una).
  for (let shift = 0; shift < n * 2; shift++) {
    if (await page.getByText("Jugar otra vez").count()) break;
    const free = page
      .locator(".connect-grid ul")
      .nth(0)
      .locator("button:not(.right)");
    const freeRight = page
      .locator(".connect-grid ul")
      .nth(1)
      .locator("button:not(.right)");
    const m = await free.count();
    for (let i = 0; i < m; i++) {
      await free.nth(i).click();
      await freeRight.nth((i + shift) % m).click();
    }
    await page.getByRole("button", { name: "Comprobar" }).click();
    await page.waitForTimeout(500);
  }
  await expect(page.getByText("Jugar otra vez")).toBeVisible();
  await expect(page.locator(".why-list li")).toHaveCount(n);
});
