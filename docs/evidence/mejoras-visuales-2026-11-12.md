# Mejoras visuales y del tutor · 12 de noviembre de 2026

Registro breve de lo entregado y comprobado. Contexto y decisiones en [CONTEXTO.md](../CONTEXTO.md) y el [ADR 0006](../adr/0006-recursos-interactivos-libres.md).

## Entregado

| Área              | Cambio                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interactivos      | Versión 2: HTML/CSS/JS libres en sandbox aislado con kit de diseño (azul y oro). Incluye gráficas con puntos arrastrables, escenas 3D en R³ que se giran (`EC.scene3d`), grafos con estados que avanzan paso a paso (`EC.graph`), canvas animado, barras, fórmulas KaTeX, números que cuentan y confeti. La IA responde en secciones y el servidor valida |
| Práctica          | Tarjetas con giro 3D y rondas de repaso; cuestionario de una pregunta por pantalla con acierto/error animado y repaso de falladas; ejercicios (abiertos, completar, ordenar) con pistas graduales; conexiones con comprobación y explicación                                                                                                              |
| Tutor             | Personalidades y modos reales, longitud elegible (cortas por defecto), conversación ordenada, resumen sin cortes, contexto del estudiante y la materia, saludos sin «no encontré información», reintento automático si la respuesta llega ilegible, baja sola al mensaje nuevo                                                                            |
| Acciones y avisos | El tutor sugiere botones (con instrucción lista) y un observador global avisa con una tarjeta animada cuando un recurso termina, aunque la persona esté en otra pantalla                                                                                                                                                                                  |
| Navegación        | Direcciones reales (Atrás, recargar y enlaces funcionan), hoja global «Crear» y paleta Ctrl+K para ir a materias, recursos y acciones escribiendo                                                                                                                                                                                                         |
| Materia e inicio  | La materia se organiza en pestañas (Resumen, Apuntes, Recursos, Pendientes) con dirección propia y barra fija al bajar; el inicio sugiere el siguiente paso de cada materia («Continúa donde te quedaste»)                                                                                                                                              |
| Biblioteca y más  | Biblioteca global con filtros, Calendario (agenda y horario en pestañas), botón flotante del tutor, color de acento por tipo y avisos agrupados                                                                                                                                                                                                               |
| Dibujo            | `EC.sketch`: predecir dibujando con lápiz, borrador, colores, deshacer, revelar la curva real y alternativa con botones; el modelo real lo usó bien en una generación (comparó con `pad.value`)                                                                                                                                                              |
| Experiencia       | Progreso por etapas al generar, cambios rápidos con un toque, el recurso se abre arriba, atajos de teclado, sin spinners; barra lateral azul a toda la altura con íconos grandes (sin el bloque de la estrella)                                                                                                                                           |

## Verificación

- Backend: 89 pruebas unitarias, Ruff y mypy; contratos regenerados y sincronizados. `pnpm check` y `pnpm test:unit` en verde.
- Recorridos e2e con DeepSeek real y emuladores de Auth/Firestore (no son pruebas cloud): 18 pruebas, incluidas accesibilidad con axe en escritorio y móvil, seguridad del renderer, recursos, práctica, ejercicios y conexiones.
- `pnpm eval:ai:h3` (14 recursos y 6 preguntas sintéticas): 14/14 recursos válidos con citas, uno necesitó una reparación; tutor con apuntes 4/4 correctas y citadas, 42 palabras de media (máximo 61); 2/2 preguntas fuera de los apuntes reconocidas sin inventar citas.
- Generación real de interactivos en siete temas nuevos (R³ con plano tangente, vectores y producto cruz, descenso del gradiente, Dijkstra, BFS/DFS, ondas, grandes números) válidos al primer intento. Subir el límite de salida (24 000 y luego 32 000 tokens) evitó cortes en los temas más largos.
- Pedidos fuera del arsenal con el modelo real: «sin deslizadores» (se respetó), lienzo libre con vectores arrastrables (SVG propio) y tres lecciones guiadas con `EC.lesson` (sistemas 2×2, binario a decimal, regla de la cadena), todas válidas al primer intento.
- Capturas de revisión en el Escritorio del usuario (`EduCloud-capturas`), tomadas con la aplicación real.

## Hallazgo durante la verificación

Con el historial como turnos alternados, DeepSeek en modo JSON devolvió respuestas ilegibles (espacios o texto suelto) en 2 de 10 turnos; con el historial ordenado dentro del último mensaje y un recordatorio de formato fueron 0 de 10. Se adoptó el segundo formato y se añadió un reintento único cuando el costo del primer intento es conocido. La prueba e2e del tutor lo detectó antes de cerrar.

## Límites

- La calidad visual de cada interactivo depende de lo que genere el modelo; no se promete el mismo nivel en todos los temas. Los gestos táctiles del 3D se probaron con puntero, no en un dispositivo táctil real.
- El JavaScript generado se valida con reglas estáticas; un error de ejecución se detecta al abrir el recurso. El sandbox no es una certificación frente a vulnerabilidades del navegador (ver ADR 0006).
- Solo Chromium; móvil emulado a 390 px.
- La prueba e2e de práctica falló una vez en tres ejecuciones y pasó al repetirla: una condición de carrera que ya existía (el panel de progreso se consulta una sola vez y puede mostrar una sugerencia anterior si el apunte aún se procesa). No se corrigió.
- Streaming del tutor, simulaciones y «explicar al tutor» no se incluyen.
