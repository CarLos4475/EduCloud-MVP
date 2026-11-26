import { expect, test } from "@playwright/test";

test.skip(!process.env.EDUCLOUD_MVP_TEST, "Requiere la compilación MVP");

test("el espacio local conserva el calendario y permite consultar el apunte con el tutor", async ({
  page,
}) => {
  if (!process.env.EDUCLOUD_MVP_LIVE)
    await page.route("**/api/tutor", (route) => {
      if (route.request().postDataJSON()?.action === "create-vector-challenge")
        return route.fulfill({
          json: {
            title: "Dos direcciones",
            scenario:
              "Cambia la dirección de un vector para cubrir el área pedida.",
            slope: 1,
            targetY: 4,
          },
        });
      return route.fulfill({
        json: {
          text: "El segundo vector es el doble del primero.",
          cited: true,
          quote:
            "Si el determinante es cero, los vectores son linealmente dependientes.",
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
    page.getByRole("button", { name: "Ver apuntes de Álgebra lineal" }),
  ).toBeVisible();
  await expect(page.getByText(/pasaporte/i)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.reload();
  await expect(
    page.getByText("Repasar independencia lineal").first(),
  ).toBeVisible();
  await navigation.getByRole("button", { name: "Inicio" }).click();
  await page
    .getByRole("button", { name: "Ver apuntes de Álgebra lineal" })
    .click();
  await expect(page).toHaveURL(/\/materias\/algebra-lineal\/apuntes$/);
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
  await expect(
    page.getByText(/Apunte activo:.*Independencia lineal/i),
  ).toBeVisible();
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
    .fill("¿Por qué son dependientes (2, 1) y (4, 2)?");
  await page.getByRole("button", { name: "Enviar pregunta" }).click();
  await page.getByRole("button", { name: /Abrir cita S1/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Fuente citada" }),
  ).toContainText("determinante es cero");
  await page.getByRole("button", { name: "Cerrar fuente" }).click();
  await page.getByRole("button", { name: "Cerrar tutor" }).click();
  await page.getByRole("button", { name: "Practicar", exact: true }).click();
  await expect(page).toHaveURL(
    /\/materias\/algebra-lineal\/recursos\/practica-vectores$/,
  );
  await expect(
    page.getByRole("button", { name: "Eliminar recurso" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "0", exact: true }).click();
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
  await expect(page).toHaveURL(
    /\/materias\/algebra-lineal\/recursos\/[\w-]+$/,
    {
      timeout: 22_000,
    },
  );
  const slider = page.getByRole("slider", {
    name: "Componente y del vector v",
  });
  const goal = page.getByTestId("vector-goal");
  await expect(slider).toBeVisible();
  await expect(
    page.getByText("Vectores dependientes", { exact: true }),
  ).toBeVisible();
  const { slope, determinant } = await goal.evaluate((element) => ({
    slope: Number(element.dataset.slope),
    determinant: Number(element.dataset.determinant),
  }));
  await slider.fill(String(determinant / 2 + 2 * slope));
  await expect(page.getByText("¡Meta alcanzada!")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "De dónde sale" }),
  ).toBeVisible();
  await page.reload();
  await expect(slider).toBeVisible();
  const remove = page.getByRole("button", { name: "Eliminar recurso" });
  await expect(remove).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(slider).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page).toHaveURL(/\/materias\/algebra-lineal\/recursos$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Práctica de vectores/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Experimento interactivo/ }),
  ).toHaveCount(0);
});

test("a saved workspace receives Álgebra lineal without losing its old materials", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const key = "educloud.local.data.v1";
    if (localStorage.getItem(key)) return;
    localStorage.setItem("educloud.local.session.v1", "1");
    localStorage.setItem(
      key,
      JSON.stringify({
        profile: { id: "local", revision: 1, displayName: "Andrea" },
        lists: {
          subjects: [
            { id: "circuitos", revision: 1, name: "Circuitos eléctricos" },
          ],
          agenda: [
            {
              id: "repaso",
              revision: 1,
              subjectId: "circuitos",
              title: "Repasar la ley de Ohm",
            },
          ],
          schedule: [],
          topics: [],
          periods: [],
        },
        materials: [
          {
            id: "attached",
            subjectId: "circuitos",
            name: "Tarea.pdf",
            status: "local",
          },
        ],
        resources: [],
        conversations: [],
        turns: [],
        attempts: [],
        reviews: {},
      }),
    );
  });
  await page.goto(process.env.EDUCLOUD_MVP_URL ?? "http://127.0.0.1:5173");
  await expect(
    page.getByRole("button", { name: "Ver apuntes de Álgebra lineal" }),
  ).toBeVisible();
  await expect(page.getByText("Repasar la ley de Ohm")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ver apuntes de Álgebra lineal" }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("educloud.local.data.v1")!),
  );
  expect(saved.profile.displayName).toBe("Andrea");
  expect(saved.lists.subjects).toEqual([
    expect.objectContaining({ id: "circuitos", archived: true }),
    expect.objectContaining({ id: "algebra-lineal", archived: false }),
  ]);
  expect(saved.materials).toContainEqual(
    expect.objectContaining({ name: "Tarea.pdf" }),
  );
});
