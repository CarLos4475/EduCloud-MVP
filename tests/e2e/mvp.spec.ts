import { expect, test } from "@playwright/test";

test.skip(!process.env.EDUCLOUD_MVP_TEST, "Requiere la compilación MVP");

test("el espacio local conserva el calendario y permite consultar el apunte con el tutor", async ({
  page,
}) => {
  if (!process.env.EDUCLOUD_MVP_LIVE)
    await page.route("**/api/tutor", (route) => {
      if (route.request().postDataJSON()?.action === "create-ohm-challenge")
        return route.fulfill({
          json: {
            title: "Un motor en el taller",
            scenario: "Ajusta la corriente que recibe un motor de prueba.",
            voltage: 12,
            targetResistance: 4,
          },
        });
      return route.fulfill({
        json: {
          text: "A voltaje constante, una resistencia mayor reduce la corriente.",
          cited: true,
          quote:
            "Si el voltaje permanece fijo y aumenta la resistencia, la corriente disminuye.",
        },
      });
    });
  const baseUrl = process.env.EDUCLOUD_MVP_URL ?? "http://127.0.0.1:5173";
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Crear mi espacio" }).click();
  await page.getByLabel("Tu nombre").fill("Alex");
  await page.getByRole("button", { name: "Guardar mi espacio" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Navegación principal",
  });
  await expect(navigation.getByRole("button")).toHaveText([
    "Inicio",
    "Materias",
    "Calendario",
  ]);
  await expect(
    page.getByRole("button", { name: "Ver apuntes de Circuitos eléctricos" }),
  ).toBeVisible();
  await expect(page.getByText(/pasaporte/i)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.reload();
  await expect(page.getByText("Repasar la ley de Ohm").first()).toBeVisible();
  await navigation.getByRole("button", { name: "Inicio" }).click();
  await page
    .getByRole("button", { name: "Ver apuntes de Circuitos eléctricos" })
    .click();
  await expect(page).toHaveURL(/\/materias\/circuitos\/apuntes$/);
  await expect(page.getByRole("button", { name: "Guardar nota" })).toHaveCount(
    0,
  );
  await page.getByLabel("Adjuntar material").setInputFiles({
    name: "mis-apuntes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7"),
  });
  await expect(
    page.getByText("mis-apuntes.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preguntar al tutor", exact: true })
    .click();
  await expect(
    page.locator("details", { hasText: "Opciones del tutor" }),
  ).not.toHaveAttribute("open");
  await expect(page.getByText(/Apunte activo:.*Ley de Ohm/i)).toBeVisible();
  const tutorOptions = page.getByText("Opciones del tutor", { exact: true });
  await tutorOptions.click();
  await expect(
    page.getByRole("checkbox", {
      name: "Autorizar conocimiento general solo para esta pregunta",
    }),
  ).not.toBeChecked();
  await tutorOptions.click();
  await page
    .getByLabel("Tu pregunta")
    .fill("¿Qué pasa si aumenta la resistencia?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await page.getByRole("button", { name: /Abrir cita S1/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Fuente citada" }),
  ).toContainText("voltaje permanece fijo");
  await page.getByRole("button", { name: "Cerrar fuente" }).click();
  await page.getByRole("button", { name: "Cerrar tutor" }).click();
  await page.getByRole("button", { name: "Practicar", exact: true }).click();
  await expect(page).toHaveURL(
    /\/materias\/circuitos\/recursos\/practica-ohm$/,
  );
  await expect(
    page.getByRole("button", { name: "Eliminar recurso" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "2 A", exact: true }).click();
  await page.getByRole("button", { name: "Ver mi resultado" }).click();
  await expect(page.getByText(/Acertaste 1 de 1/)).toBeVisible();
  await page.getByRole("button", { name: "Ver tu progreso" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu progreso" }),
  ).toBeInViewport();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Crear recurso", exact: true })
    .click();
  await expect(page).toHaveURL(/\/materias\/circuitos\/recursos\/[\w-]+$/, {
    timeout: 22_000,
  });
  const resistance = page.getByRole("slider", { name: "Resistencia" });
  const goal = page.getByTestId("ohm-goal");
  await expect(resistance).toBeVisible();
  // The goal is always reachable with a whole-number resistance.
  const { voltage, current } = await goal.evaluate((element) => ({
    voltage: Number(element.dataset.voltage),
    current: Number(element.dataset.current),
  }));
  await resistance.fill(String(Math.round(voltage / current)));
  await expect(page.getByText("¡Meta alcanzada!")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "De dónde sale" }),
  ).toBeVisible();
  await page.reload();
  await expect(resistance).toBeVisible();
  const remove = page.getByRole("button", { name: "Eliminar recurso" });
  await expect(remove).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(resistance).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page).toHaveURL(/\/materias\/circuitos\/recursos$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Práctica de la ley de Ohm/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Experimento interactivo/ }),
  ).toHaveCount(0);
});
