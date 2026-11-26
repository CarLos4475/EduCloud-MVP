# EduCloud para revisión en Vercel

La compilación usa las pantallas actuales de EduCloud. La sesión, los registros de ejemplo, el calendario, la práctica y el progreso se guardan en el navegador. El registro pide un nombre. Los adjuntos registran nombre y tamaño. La vista de tutor enlaza al apunte «Ley de Ohm» que se incluye en el proyecto. Los recursos listos para repasar son ejemplos preparados. El visor de interactivos generados conserva su configuración aislada en la aplicación completa.

## Prueba local

En la raíz, ejecutar `pnpm --filter @campus/web dev:mvp` y abrir `http://127.0.0.1:5173`. Este modo funciona de forma independiente a Firebase y FastAPI. Para comprobar la respuesta real, el servidor de Vite lee `DEEPSEEK_API_KEY` de la configuración local y la usa en su middleware. El navegador recibe únicamente la respuesta.

Para verificar el recorrido con una respuesta controlada de red:

```powershell
$env:EDUCLOUD_MVP_TEST='1'
pnpm test:e2e tests/e2e/mvp.spec.ts
node --test tests/mvp-tutor.test.mjs
pnpm --filter @campus/web build:mvp
```

## Configuración del proyecto

- Crear o vincular un proyecto Vercel con **Root Directory** `apps/web` y permitir que la compilación use los archivos del monorepo fuera de esa carpeta. La configuración está en [vercel.json](../../apps/web/vercel.json). Se instala desde el workspace y se ejecuta `pnpm build:mvp`. El directorio público es `dist`.
- La web y `POST /api/tutor` comparten el dominio. Las rutas de materias, biblioteca, calendario y perfil reescriben a `index.html`. La función reside en `api/tutor.mjs`. La conexión usa el mismo origen.
- Configurar una regla de [Vercel Firewall](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) para limitar las solicitudes a `/api/tutor` antes de activar el tutor público. Agregar `DEEPSEEK_API_KEY` en variables sensibles del servidor. Activar `EDUCLOUD_TUTOR_ENABLED=1` solo en el entorno que se va a entregar y desplegar la configuración correspondiente. La API devuelve 503 mientras esa opción está desactivada. Mantener `.env` fuera de la publicación y guardar las claves del lado del servidor.
- Abrir el enlace en incógnito. Crear un espacio, recargar una ruta de materia, seleccionar un archivo de ejemplo, consultar el tutor y abrir la cita. Contestar la práctica y confirmar el resultado en «Tu progreso». Añadir el enlace al documento de entrega cuando funcione.

La API acepta preguntas breves por POST JSON desde el origen de la aplicación, con máximo 4 KiB de entrada y de 350 a 700 tokens según la extensión de respuesta. Limita el tiempo de la llamada y comprueba que el fragmento citado exista en el apunte. La función recibe la pregunta y opciones del tutor. El navegador guarda el historial y ofrece borrarlo. La comprobación del origen y el límite de solicitudes del Firewall son controles distintos.

Security check:
- Data touched: perfil local, actividad de estudio, metadatos de adjuntos y texto de la pregunta.
- Auth required: el perfil local no es una cuenta autenticada. La función pública presta un servicio acotado sin acceso a cuentas.
- Authorization enforced at: la función recibe solo la pregunta y opciones acotadas, y usa un apunte fijo del proyecto.
- Secrets: clave en el servidor. Se comprobó que el valor real no aparece en el JavaScript compilado.
- Input validation: mismo origen para el POST del navegador, JSON acotado y pregunta de hasta 480 caracteres.
- Output rendering: Markdown seguro existente. Las citas requieren un fragmento literal del apunte.
- Logs/errors: la función devuelve mensajes genéricos y no registra la pregunta, las cabeceras ni la clave.
- DB/storage rules: datos del espacio en el navegador. Los archivos seleccionados no salen del dispositivo.
- Dependencies: se reutilizaron Vite, Node y el visor existente sin añadir dependencias.
- Rate limiting / abuse controls: cuerpo, salida y tiempo acotados. Falta configurar y verificar la regla del Firewall en el proyecto Vercel.
- Web risks: CSP en la configuración, destino externo fijo y respuestas sin caché. Cabeceras pendientes de comprobar en el enlace desplegado.
- Prototype/security debt: el espacio pertenece al navegador y usa material de ejemplo. La cuenta institucional, la ingestión y el almacenamiento de documentos siguen en el modo completo.
