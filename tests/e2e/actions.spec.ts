import { test, expect, Page } from "@playwright/test";

// El tutor sugiere una acción, se acepta con un toque y, aunque la persona salga a otra
// pantalla, llega un aviso cuando el recurso está listo.
async function prepare(page: Page) {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Es mi primera visita" }).click();
  await page
    .getByLabel("Correo electrónico")
    .fill(`acciones-${Date.now()}@pcpuma.acatlan.unam.mx`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-study-2026!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear mi primera materia" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Circuitos acciones");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: /Circuitos acciones.*temas/ }).click();
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

test("el tutor sugiere una acción y el aviso llega aunque salgas de la materia", async ({
  page,
}) => {
  test.setTimeout(420000);
  await prepare(page);
  await page.getByRole("button", { name: "✦ Abrir tutor" }).click();
  const tutor = page.getByRole("dialog", { name: "Tutor", exact: true });
  await tutor.getByLabel("Fuente: Ley de Ohm").check();
  await tutor
    .getByLabel("Tu pregunta")
    .fill("Explícame la ley de Ohm y quiero repasarla con tarjetas");
  await tutor.getByRole("button", { name: "Enviar pregunta" }).click();

  // La respuesta trae al menos una acción sugerida, con la opción de editarla antes.
  const action = tutor.locator(".tutor-action > button.secondary").first();
  await expect(action).toBeVisible({ timeout: 120000 });
  await expect(
    tutor.getByRole("button", { name: "Editar antes" }).first(),
  ).toBeVisible();
  await action.click();
  await expect(tutor.getByText(/Te aviso cuando esté listo/)).toBeVisible();

  // Sale a otra parte de la aplicación: el aviso global sigue el trabajo.
  await tutor.getByRole("button", { name: "Cerrar tutor" }).click();
  await page
    .getByRole("button", { name: "Biblioteca", exact: true })
    .first()
    .click();
  await expect(page.locator(".toast-pending")).toBeVisible({ timeout: 10000 });
  const toast = page.locator(".toast.ready");
  await expect(toast).toBeVisible({ timeout: 200000 });
  await expect(toast).toContainText(/list[oa]s?!/);
  await toast.getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".resource-viewer")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".toast.ready")).toHaveCount(0);
});

test("«Editar antes» abre el formulario con la instrucción ya escrita", async ({
  page,
}) => {
  test.setTimeout(240000);
  await prepare(page);
  await page.getByRole("button", { name: "✦ Abrir tutor" }).click();
  const tutor = page.getByRole("dialog", { name: "Tutor", exact: true });
  await tutor.getByLabel("Fuente: Ley de Ohm").check();
  await tutor
    .getByLabel("Tu pregunta")
    .fill("Explícame la ley de Ohm y quiero practicar con ejercicios");
  await tutor.getByRole("button", { name: "Enviar pregunta" }).click();
  const edit = tutor.getByRole("button", { name: "Editar antes" }).first();
  await expect(edit).toBeVisible({ timeout: 120000 });
  await edit.click();
  await expect(page.getByLabel(/algo en particular/i)).not.toHaveValue("", {
    timeout: 10000,
  });
  await expect(page.getByText("¿Qué quieres crear?")).toBeVisible();
});
