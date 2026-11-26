# Desarrollo local de EduCloud

Requisitos: Node 24, pnpm 11, Python 3.12 o 3.13, uv y Java 21. En Windows, el script de emuladores también reconoce un JRE 21 en `.tools/java21`.

En una terminal:

```powershell
pnpm install --frozen-lockfile
uv sync --project backend --locked
pnpm emulators
```

En otra terminal, ejecuta `pnpm dev` y abre [la aplicación local](http://127.0.0.1:5173). Si aún no existe `.env`, parte de `.env.example`. Conserva las claves configuradas. En Windows, reinicia `pnpm dev` tras cambiar Python. El [laboratorio](http://127.0.0.1:5173/h0.html) y la [documentación de la API](http://127.0.0.1:8000/docs) también se abren en local.

Para probar solo la versión pública, sin emuladores, sigue la [guía de Vercel](mvp-vercel.md). Para usar Firebase real desde local, consulta el [runbook de H2](desarrollo-h2.md). La integración de almacenamiento está descrita en [Storage pendiente](storage-pendiente.md).

## Verificación

```powershell
pnpm check
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm audit --prod
pnpm --filter @campus/web build
pnpm --filter @campus/renderer build
```

La integración necesita emuladores. Para los recorridos de navegador sin consumo de IA, inicia los servicios con el proveedor de prueba del [runbook de H2](desarrollo-h2.md).

`pnpm contracts:generate` actualiza OpenAPI y los tipos del cliente. `pnpm contracts:check` comprueba que estén sincronizados. Las evaluaciones `pnpm eval:ai:h2` y `pnpm eval:ai:h3` usan DeepSeek real con ejemplos sintéticos. `pnpm test:cloud:h2 --preflight` comprueba la disponibilidad del índice de Firestore mediante una consulta de solo lectura. Los [cierres de H2](../evidence/cierre-h2.md) y [H3/H4](../evidence/cierre-h3-h4.md) distinguen las pruebas locales de las de servicios reales.
