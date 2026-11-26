import { expect, test } from "@playwright/test";

test.skip(!process.env.EDUCLOUD_MVP_TEST, "Requiere la compilación MVP");

test("el espacio local conserva el calendario y permite consultar el apunte con el tutor", async ({
  page,
}) => {
  if (!process.env.EDUCLOUD_MVP_LIVE)
    await page.route("**/api/tutor", (route) =>
      route.fulfill({
        json: {
          text: "A voltaje constante, una resistencia mayor reduce la corriente.",
          cited: true,
          quote:
            "Si el voltaje permanece fijo y aumenta la resistencia, la corriente disminuye.",
        },
      }),
    );
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await page.getByLabel("Tu nombre").fill("Alex");
  await page.getByRole("button", { name: "Guardar mi espacio" }).click();
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.reload();
  await expect(page.getByText("Repasar la ley de Ohm").first()).toBeVisible();
  await page.goto("http://127.0.0.1:5173/materias/circuitos/apuntes");
  await page.getByLabel("Adjuntar material").setInputFiles({
    name: "mis-apuntes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7"),
  });
  await expect(
    page.getByText("mis-apuntes.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Abrir tutor/ }).click();
  await page
    .getByLabel("Tu pregunta")
    .fill("¿Qué pasa si aumenta la resistencia?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await page.getByRole("button", { name: /Abrir cita S1/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Fuente citada" }),
  ).toContainText("voltaje permanece fijo");
  await page.getByRole("button", { name: "Cerrar fuente" }).click();
  await page.goto(
    "http://127.0.0.1:5173/materias/circuitos/recursos/practica-ohm",
  );
  await page.getByRole("button", { name: "2 A", exact: true }).click();
  await page.getByRole("button", { name: "Ver mi resultado" }).click();
  await expect(page.getByText(/Acertaste 1 de 1/)).toBeVisible();
  await page.getByRole("button", { name: /Volver a mis recursos/ }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
});
