# EduCloud para revisión en Vercel

Abre [EduCloud en Vercel](https://educloud-mvp.vercel.app) y elige «Crear mi espacio». Basta con un nombre. El calendario y el avance se guardan en ese navegador. Al elegir un archivo, la aplicación guarda su nombre y tamaño. El tutor responde con DeepSeek y puede citar el apunte «Independencia lineal», que viene con el espacio. La práctica, las tarjetas y el resumen están disponibles desde el inicio. En Recursos de Álgebra lineal, «Crear recurso» genera un reto de vectores con DeepSeek y lo guarda en el navegador. Los espacios existentes reciben el ejemplo nuevo y conservan el anterior en Materias archivadas.

## Prueba local

Desde la raíz, ejecuta `pnpm --filter @campus/web dev:mvp` y abre `http://127.0.0.1:5173`. Vite lee `DEEPSEEK_API_KEY` de la configuración local y llama a DeepSeek desde el servidor. Para esta prueba basta con Vite.

Para verificar el recorrido con una respuesta controlada de red:

```powershell
$env:EDUCLOUD_MVP_TEST='1'
pnpm test:e2e tests/e2e/mvp.spec.ts
node --test tests/mvp-tutor.test.mjs
pnpm --filter @campus/web build:mvp
```

## Publicación

Vercel toma `main` de [EduCloud-MVP](https://github.com/CarLos4475/EduCloud-MVP). El directorio raíz del proyecto es `apps/web` y la compilación usa Node 24 y `pnpm build:mvp`. La web y `POST /api/tutor` comparten el dominio. Las reglas de navegación y la salida `dist` están en [vercel.json](../../apps/web/vercel.json).

`DEEPSEEK_API_KEY` está guardada como secreto de producción. `EDUCLOUD_TUTOR_ENABLED=1` habilita el tutor en ese entorno. Vercel Firewall permite hasta ocho solicitudes al tutor por minuto por IP. Si configuras otro entorno, aplica su límite antes de habilitar la función. Mantén `.env` fuera del repositorio.

Después de publicar un cambio, abre el enlace en incógnito y crea un espacio. Abre el calendario y vuelve a Inicio. Entra por «Ver apuntes de Álgebra lineal», registra un archivo y elige «Preguntar al tutor». Abre la cita sobre independencia lineal, cierra el tutor y elige «Practicar». Abre «Ver tu progreso» y crea un reto. Mueve el vector hasta alcanzar el determinante objetivo.

La API acepta preguntas breves por POST JSON desde el origen de la aplicación, con máximo 4 KiB de entrada y de 350 a 700 tokens según la extensión de respuesta. Limita el tiempo de la llamada y comprueba que el fragmento citado exista en el apunte. La generación del reto usa la misma ruta y su límite de solicitudes. Envía solo una instrucción fija y el apunte de ejemplo. El servidor valida el texto y los valores del reto. La aplicación calcula la corriente y dibuja la simulación con sus componentes.

Security check:
- Data touched: perfil local, actividad de estudio, metadatos de adjuntos, texto de la pregunta y retos guardados en el navegador.
- Auth required: el perfil local no es una cuenta autenticada. La función pública presta un servicio acotado sin acceso a cuentas.
- Authorization enforced at: la función recibe preguntas con opciones acotadas o una acción fija de generación, y usa un apunte fijo del proyecto.
- Secrets: clave en el servidor. Se comprobó que el valor real no aparece en el JavaScript compilado.
- Input validation: mismo origen para el POST del navegador, JSON acotado y pregunta de hasta 480 caracteres.
- Output rendering: Markdown seguro para el tutor. Las citas requieren un fragmento literal del apunte. El reto usa texto escapado y valores numéricos validados para sus controles.
- Logs/errors: la función devuelve mensajes genéricos y no registra la pregunta, las cabeceras ni la clave.
- DB/storage rules: datos del espacio en el navegador. Los archivos seleccionados no salen del dispositivo.
- Dependencies: se reutilizaron Vite, Node y el visor existente sin añadir dependencias.
- Rate limiting / abuse controls: cuerpo, salida y tiempo acotados. La regla activa de Vercel limita `/api/tutor` a ocho solicitudes por minuto por IP.
- Web risks: se verificaron la política de contenido de la web y las respuestas sin caché de la API en producción. El destino de la consulta de IA es fijo.
- Prototype/security debt: el espacio pertenece al navegador y usa material de ejemplo. La cuenta institucional, la ingestión y el almacenamiento de documentos siguen en el modo completo.
