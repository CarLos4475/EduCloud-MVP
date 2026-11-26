import { test, expect, Page } from "@playwright/test";

// Direcciones reales, hoja de «Crear» y paleta Ctrl+K. Sin IA: solo navegación.
async function register(page: Page, label: string) {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Es mi primera visita" }).click();
  await page
    .getByLabel("Correo electrónico")
    .fill(`${label}-${Date.now()}@pcpuma.acatlan.unam.mx`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-study-2026!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Crear mi primera materia" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cálculo navegación");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page
    .getByRole("button", { name: /Cálculo navegación.*temas/ })
    .waitFor();
}

test("la dirección sigue a la pantalla: Atrás, recargar y enlace directo", async ({
  page,
}) => {
  await register(page, "ruta");
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page
    .getByRole("button", { name: "Materias", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/materias$/);
  await page.getByRole("button", { name: /Cálculo navegación.*temas/ }).click();
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+$/);
  const subjectUrl = page.url();

  // Atrás vuelve a la lista de materias y Adelante a la materia.
  await page.goBack();
  await expect(page).toHaveURL(/\/materias$/);
  await expect(
    page.getByRole("heading", { name: "Cálculo navegación", level: 1 }),
  ).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(subjectUrl);
  await expect(
    page.getByRole("heading", { name: "Cálculo navegación", level: 1 }),
  ).toBeVisible();

  // Recargar conserva el lugar; abrir el enlace directo también.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Cálculo navegación", level: 1 }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(subjectUrl);

  // Salir limpia la dirección.
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:5173\/$/);
});

test("la materia tiene pestañas con dirección propia que sobreviven a recargar", async ({
  page,
}) => {
  await register(page, "pestanas");
  await page.getByRole("button", { name: /Cálculo navegación.*temas/ }).click();
  const tabs = page.getByRole("tablist", { name: "Secciones de la materia" });
  await expect(tabs.getByRole("tab", { name: "Resumen" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Temas" })).toBeVisible();

  await tabs.getByRole("tab", { name: "Apuntes" }).click();
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+\/apuntes$/);
  await expect(page.getByLabel("Título de la nota")).toBeVisible();

  await tabs.getByRole("tab", { name: "Recursos" }).click();
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+\/recursos$/);
  await expect(
    page.getByRole("heading", { name: "Recursos para estudiar" }),
  ).toBeVisible();

  await tabs.getByRole("tab", { name: "Pendientes" }).click();
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+\/pendientes$/);
  await expect(
    page.getByRole("heading", { name: "Pendientes de la materia" }),
  ).toBeVisible();

  // Atrás vuelve a la pestaña anterior y recargar conserva la actual.
  await page.goBack();
  await expect(page).toHaveURL(/\/recursos$/);
  await page.reload();
  await expect(
    page
      .getByRole("tablist", { name: "Secciones de la materia" })
      .getByRole("tab", { name: "Recursos" }),
  ).toHaveAttribute("aria-selected", "true", { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "Recursos para estudiar" }),
  ).toBeVisible();
});

test("el inicio sugiere el siguiente paso de cada materia", async ({
  page,
}) => {
  await register(page, "continua");
  await page
    .getByRole("button", { name: "Inicio", exact: true })
    .first()
    .click();
  const section = page.getByRole("region", {
    name: "Continúa donde te quedaste",
  });
  await expect(section).toBeVisible();
  // Sin apuntes todavía, lo primero es subirlos; el botón lleva directo a esa pestaña.
  const tile = section.getByRole("button", { name: /Sube tus apuntes/ });
  await expect(tile).toBeVisible({ timeout: 15000 });
  await tile.click();
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+\/apuntes$/);
  await expect(page.getByLabel("Título de la nota")).toBeVisible();
});

test("biblioteca y calendario: direcciones, pestañas y enlaces viejos", async ({
  page,
}) => {
  await register(page, "biblio");
  await page
    .getByRole("button", { name: "Biblioteca", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/biblioteca$/);
  await expect(
    page.getByRole("heading", { name: "Mi biblioteca." }),
  ).toBeVisible();
  await expect(page.getByText("Tu biblioteca está vacía.")).toBeVisible({
    timeout: 15000,
  });
  await page.getByPlaceholder("Buscar un recurso…").fill("zzz");
  await page.getByRole("button", { name: "+ Crear un recurso" }).click();
  await expect(
    page.getByRole("dialog", { name: "¿Qué quieres crear?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Calendario une agenda y horario en pestañas; la barra lateral queda en «Calendario».
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/calendario$/);
  await page.getByRole("tab", { name: "Horario" }).click();
  await expect(page).toHaveURL(/\/calendario\/horario$/);
  await expect(
    page.getByRole("button", { name: "Calendario", exact: true }).first(),
  ).toHaveClass(/active/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Horario" })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 20000 },
  );

  // Las direcciones anteriores siguen abriendo el lugar correcto.
  await page.goto("http://127.0.0.1:5173/agenda");
  await expect(page.getByRole("tab", { name: "Pendientes" })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 20000 },
  );
});

test("el botón flotante abre el tutor ya situado en la materia", async ({
  page,
}) => {
  await register(page, "flotante");
  await page.getByRole("button", { name: /Cálculo navegación.*temas/ }).click();
  const fab = page.getByRole("button", {
    name: "Preguntar al tutor sobre Cálculo navegación",
  });
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.getByRole("dialog", { name: /tutor/i })).toBeVisible();
  await expect(fab).toHaveCount(0);
});

test("Ctrl K encuentra materias y acciones; la hoja de Crear se abre desde cualquier parte", async ({
  page,
}) => {
  await register(page, "paleta");
  await page
    .getByRole("button", { name: "Calendario", exact: true })
    .first()
    .click();

  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Buscar o ir a" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("calculo");
  await expect(
    palette.getByRole("option", { name: /Cálculo navegación/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/materias\/[a-f0-9]+$/);
  await expect(palette).toHaveCount(0);

  // Crear desde la paleta abre la hoja con el tipo ya elegido.
  await page.keyboard.press("Control+K");
  await palette.getByRole("combobox").fill("crear tarjetas");
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "¿Qué quieres crear?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Tarjetas" })).toBeChecked();
  await expect(sheet.getByLabel("Materia")).toHaveValue(/[a-f0-9]+/);

  // Escape cierra; el botón «+ Crear» de la barra la vuelve a abrir desde Inicio.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page
    .getByRole("button", { name: "Inicio", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "+ Crear", exact: true }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByText("Experimento interactivo", { exact: true }).click();
  await expect(sheet.getByRole("button", { name: "3D (R³)" })).toBeVisible();
  await sheet.getByRole("button", { name: "Lección guiada" }).click();
  await expect(sheet.getByLabel(/algo en particular/i)).toHaveValue(
    /tutorial paso a paso/i,
  );
});
