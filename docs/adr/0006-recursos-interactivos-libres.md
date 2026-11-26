# ADR 0006 · Recursos interactivos libres en sandbox con kit visual

Estado: aceptado el 12 de noviembre de 2026. Complementa el [ADR 0003](0003-resource-runtime.md); no lo borra: los paquetes versión 1 siguen abriéndose con el laboratorio QuickJS.

## Problema

El laboratorio de la versión 1 solo permitía 26 etiquetas, ningún estilo propio y una gráfica de polilínea. La IA producía deslizadores y una recta; la calidad visual y didáctica quedaba muy por debajo de lo que pide el proyecto.

## Decisión

Los recursos nuevos (`schemaVersion: 2`) son HTML, CSS y JavaScript libres que se ejecutan en `/sandbox.html`, una página del origen del renderer que se incrusta con `sandbox="allow-scripts"` (sin `allow-same-origin`, por lo que su origen es opaco) dentro del iframe del renderer, que a su vez vive en un origen distinto al de la web. El código generado nunca corre en el origen principal ni en el del renderer.

Controles:

- Cabeceras propias para `/sandbox.html`: `default-src 'none'`, scripts y estilos en línea (únicos permitidos), `connect-src 'none'`, `frame-src 'none'`, `img-src`/`font-src` solo `data:`, `form-action 'none'`, `base-uri 'none'`, `worker-src 'none'`, `frame-ancestors` limitado. La página principal conserva su política estricta (se añadió `frame-src 'self'`). Estas cabeceras salen hoy de un plugin de Vite y deben configurarse igual en el alojamiento de H6.
- El arranque del sandbox neutraliza `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `RTCPeerConnection`, `WebTransport`, `Worker`, `SharedWorker`, `open` y `sendBeacon` antes de ejecutar el recurso.
- El anfitrión (`apps/renderer/src/sandbox/host.ts`) solo acepta mensajes de la ventana que creó, con origen `null`, acotados en tamaño y número. Las fórmulas las dibuja KaTeX en el anfitrión; el recurso nunca aporta HTML confiable.
- El backend aplica comprobaciones estáticas (sin `<script>`, marcos, imágenes, red, almacenamiento, `eval`, `postMessage`) y exige usar el kit y guardar el avance. Son una barrera de calidad y defensa en profundidad; **la frontera de seguridad es el sandbox**.

## Kit de diseño

El renderer entrega al sandbox un kit propio (`apps/renderer/src/sandbox/kit.css` y `kit.js`) con la identidad azul y oro: componentes (`ec-stage`, `ec-panel`, `ec-stat`, controles, avisos), gráficas con ejes y puntos arrastrables (`EC.chart`), escenas 3D que se giran (`EC.scene3d`), grafos con estados (`EC.graph`), lecciones guiadas paso a paso (`EC.lesson`), barras, canvas con bucle, matemáticas, números que cuentan, confeti y estado persistente. La IA compone con el kit en lugar de inventar estilos, lo que fija el piso de calidad visual. Tipografías y KaTeX viajan como datos (el sandbox no tiene red).

## Riesgos y límites

- WebRTC y algunos canales de precarga no siempre quedan cubiertos por CSP en todos los navegadores. El arranque desactiva las APIs conocidas, pero un marco `about:blank` podría recuperar una versión original; las comprobaciones del backend rechazan referencias a `iframe` en el JavaScript, aunque una ofuscación deliberada podría evitarlas, y `frame-src 'none'` limita la navegación, no la creación. Es un riesgo residual aceptado para el piloto: el recurso solo contiene material del propio estudiante.
- El JavaScript generado se valida con reglas estáticas; no se ejecuta en el servidor. Un error de sintaxis se detecta al abrir el recurso, que se detiene y se ofrece reiniciar o pedir otra versión.
- No es una certificación de sandbox frente a vulnerabilidades del navegador.

## Pruebas

Pruebas del backend para el análisis de secciones, las reglas estáticas y el almacenamiento v2; recorridos e2e que abren recursos generados con IA real dentro del sandbox, guardan y restauran el avance. La evaluación del sandbox con el corpus de H0 sigue en `tests/e2e/renderer.spec.ts`.

## Adenda: libreta de dibujo (`EC.sketch`)

Los recursos pueden pedir al estudiante que dibuje su predicción antes de ver la real. El trazo vive dentro del sandbox, se guarda con el estado del recurso (puntos en lista plana, límite de 60 trazos y 600 puntos por trazo) y nunca se califica automáticamente; el recurso puede compararlo con `pad.value(x)`. Toda libreta ofrece una alternativa con botones para quien no pueda dibujar. El lint de v2 acepta `EC.sketch` o `EC.keep` como guardado de avance.
