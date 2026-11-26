# Prompts de ilustraciones e iconos

Para generar con ChatGPT. Cada imagen se guarda en `apps/web/public/art/` con el nombre indicado; si falta, la app muestra un icono de respaldo ([README de art](../../apps/web/public/art/README.md)).

## Cómo usarlos

1. Empieza **cada** prompt con el estilo maestro de abajo, para que todo salga coherente.
2. Pide 1024×1024 (o la proporción indicada). La app la reduce.
3. Si ChatGPT no da fondo transparente, pide "fondo liso #F5F2EA" y quítalo con una herramienta de recorte. Con ese color de fondo también funcionan en la app.
4. Guarda como PNG con el nombre exacto de la tabla.

## Estilo maestro (pegar al inicio de cada prompt)

> Ilustración vectorial plana, estilo editorial "Block & Bold": formas geométricas sólidas, contornos gruesos y limpios en azul marino #122245, acentos en oro #b59957, rellenos suaves en arena #e9dec7 y papel #f5f2ea, con una sombra desplazada dura en oro (sin degradados, sin difuminados, sin 3D realista). Esquinas ligeramente redondeadas. Sensación universitaria de matemáticas, física e ingeniería. Sin texto, sin letras legibles, sin marcas de agua. Fondo transparente. Composición centrada con 8% de margen.

## Tutor

| Archivo                      | Tamaño  | Prompt (después del estilo maestro)                                                                                                                                                                  |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tutor-avatar.png`           | 512×512 | Mascota amable: una estrella de cuatro puntas dorada con ojos redondos y una sonrisa suave, con un birrete pequeño azul marino. Vista frontal, cabeza y hombros, pensada para recortarse en círculo. |
| `tutor-empty.png`            | 800×600 | Una estudiante sentada con laptop y cuaderno; a su lado flota la mascota estrella dorada señalando garabatos abstractos de ecuaciones (ilegibles). Ambiente tranquilo y motivador.                   |
| `personalities/patient.png`  | 256×256 | Una escalera de cuatro escalones con una figura pequeña subiendo con calma. Representa "paso a paso".                                                                                                |
| `personalities/socratic.png` | 256×256 | Una bombilla grande con un signo de interrogación dibujado como forma geométrica dentro. Representa "preguntemos".                                                                                   |
| `personalities/direct.png`   | 256×256 | Una flecha recta que atraviesa el centro de una diana. Representa "al grano".                                                                                                                        |

## Tipos de recurso

| Archivo                 | Tamaño  | Prompt                                                                             |
| ----------------------- | ------- | ---------------------------------------------------------------------------------- |
| `kinds/summary.png`     | 256×256 | Una hoja con líneas de texto abstractas y un marcador dorado en el borde.          |
| `kinds/concepts.png`    | 256×256 | Una bombilla con tres puntos conectados por líneas, como una pequeña red de ideas. |
| `kinds/flashcards.png`  | 256×256 | Dos tarjetas apiladas, la de arriba a medio voltear.                               |
| `kinds/quiz.png`        | 256×256 | Una lista con tres casillas, una con palomita dorada, y un lápiz.                  |
| `kinds/interactive.png` | 256×256 | Un matraz de laboratorio con ondas dentro y un control deslizante (slider) debajo. |

## Estampillas del pasaporte

Todas: estampilla postal circular con borde dentado, sello de tinta en azul marino y oro, 256×256.

| Archivo                     | Prompt (después del estilo maestro y la línea anterior)                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `stamps/first_material.png` | Una pluma sobre una hoja.                                               |
| `stamps/first_question.png` | Un signo de interrogación dentro de un globo de diálogo.                |
| `stamps/first_resource.png` | Una estrella dorada sobre un libro abierto.                             |
| `stamps/explorer.png`       | Un telescopio apuntando a una estrella y una brújula pequeña.           |
| `stamps/first_quiz.png`     | Una palomita grande sobre una lista de casillas.                        |
| `stamps/perfect_quiz.png`   | Una diana con la flecha exactamente en el centro y destellos alrededor. |
| `stamps/cards_ten.png`      | Un abanico de diez tarjetas abiertas.                                   |
| `stamps/three_subjects.png` | Tres libros apilados: uno azul marino, uno dorado y uno arena.          |

## Materias (cuadro 640×520, las 12 ilustraciones que se pueden elegir)

| Archivo                 | Prompt                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `subjects/grid.png`     | Una retícula de líneas finas con una franja diagonal dorada gruesa.             |
| `subjects/wave.png`     | Tres ondas senoidales superpuestas con distinta amplitud.                       |
| `subjects/orbit.png`    | Un núcleo central con tres órbitas elípticas y pequeños satélites dorados.      |
| `subjects/geometry.png` | Un triángulo con una circunferencia inscrita y un compás de dibujo.             |
| `subjects/terminal.png` | Una ventana de terminal con un cursor, un prompt y llaves { }.                  |
| `subjects/circuit.png`  | Un circuito sencillo con batería, resistencia, interruptor y un foco encendido. |
| `subjects/blocks.png`   | Bloques geométricos apilados como piezas de rompecabezas.                       |
| `subjects/compass.png`  | Una brújula grande con aguja dorada.                                            |
| `subjects/vector.png`   | Ejes cartesianos con dos vectores y su suma en oro.                             |
| `subjects/graph.png`    | Una gráfica de funciones con un área sombreada bajo la curva.                   |
| `subjects/cube.png`     | Un cubo isométrico en estructura de alambre con una cara rellena en oro.        |
| `subjects/nodes.png`    | Un grafo de nodos conectados con un nodo central dorado.                        |

## Iconos de la interfaz (128×128, trazo grueso, un solo motivo, sin sombra)

| Archivo                   | Prompt                             |
| ------------------------- | ---------------------------------- |
| `icons/nav-home.png`      | Una casa sencilla.                 |
| `icons/nav-subjects.png`  | Un libro cerrado con un marcador.  |
| `icons/nav-agenda.png`    | Un calendario con una marca.       |
| `icons/nav-schedule.png`  | Un reloj con dos manecillas.       |
| `icons/nav-profile.png`   | Una persona de pecho hacia arriba. |
| `icons/mode-explain.png`  | Un libro abierto.                  |
| `icons/mode-hints.png`    | Una brújula pequeña.               |
| `icons/mode-solution.png` | Una palomita gruesa.               |
| `icons/mode-practice.png` | Una diana con una flecha.          |

## Escenas grandes (aún no conectadas; se conectan al tenerlas)

| Archivo               | Tamaño    | Prompt                                                                                                                                                                                        |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo.png`            | 512×512   | Un bloque cuadrado azul marino con una estrella dorada de cuatro puntas en el centro.                                                                                                         |
| `login-hero.png`      | 1200×1400 | Una torre de bloques geométricos con formas inspiradas en ∫, Σ y π (como siluetas, sin letras), estrellas doradas alrededor. Pensada sobre fondo azul marino: contornos claros #f5f2ea y oro. |
| `home-hero.png`       | 600×400   | Un compás y una escuadra sobre una retícula, con una franja dorada.                                                                                                                           |
| `empty-resources.png` | 600×400   | Un cajón abierto con tarjetas y un matraz asomando, vacío y acogedor.                                                                                                                         |
| `empty-materials.png` | 600×400   | Una pila de hojas con un documento tipo PDF y una presentación, y una flecha hacia arriba.                                                                                                    |
| `empty-agenda.png`    | 600×400   | Un calendario grande con una palomita dorada y una pequeña maceta.                                                                                                                            |

## Ronda 2 (12 de noviembre de 2026): crear desde cualquier parte, biblioteca y pestañas

Todo lo de esta ronda ya funciona con iconos de respaldo; las imágenes lo harán lucir mejor. Mismo estilo maestro de arriba y mismo destino `apps/web/public/art/`. Orden sugerido de prioridad: primero los tipos de recurso nuevos y los iconos de navegación, luego el resto.

### Tipos de recurso nuevos (256×256)

| Archivo                 | Prompt                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kinds/exercises.png`   | Un lápiz sobre una hoja con un problema abstracto: una línea de operación con un hueco subrayado, una escalera de tres pasos al lado y una pista (foco pequeño) dorada. |
| `kinds/connections.png` | Dos columnas de bloques pequeños unidas por líneas gruesas que se cruzan, con un par unido en oro y una palomita pequeña.                                               |

### Estilos de interactivo (256×256, se muestran en la hoja de crear)

| Archivo                         | Prompt                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `kinds/interactive-free.png`    | Un matraz con ondas, una chispa dorada saliendo de él y una varita mágica geométrica. Representa "libre, lo que se me ocurra".             |
| `kinds/interactive-graph.png`   | Ejes cartesianos con una curva suave, un punto dorado arrastrable con una mano pequeña a su lado.                                          |
| `kinds/interactive-3d.png`      | Un paraboloide en alambre sobre ejes x, y, z en perspectiva, con una flecha curva que indica que gira, y un relleno dorado en una porción. |
| `kinds/interactive-network.png` | Un grafo de seis nodos con aristas, un nodo dorado actual y un camino resaltado en oro.                                                    |
| `kinds/interactive-lesson.png`  | Una escalera de cuatro peldaños con una bandera dorada arriba y un pequeño birrete sobre el primer peldaño. Representa "lección guiada".   |
| `kinds/interactive-sim.png`     | Un resorte con una masa, una flecha de movimiento y una pequeña onda debajo. Representa "simulación".                                      |

### Iconos de navegación y acciones (128×128, trazo grueso, un solo motivo, sin sombra)

| Archivo                     | Prompt                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `icons/nav-library.png`     | Una estantería baja con tres carpetas de colores (azul marino, oro y arena) y una tarjeta asomando.       |
| `icons/nav-calendar.png`    | Un calendario con un reloj pequeño superpuesto en la esquina. Sustituye a agenda y horario si los unimos. |
| `icons/action-create.png`   | Una estrella dorada de cuatro puntas con un signo "+" grueso en azul marino.                              |
| `icons/action-search.png`   | Una lupa con una pequeña estrella dorada dentro del cristal.                                              |
| `icons/action-continue.png` | Un marcador de libro dorado asomando entre las páginas de un libro abierto.                               |
| `icons/action-tutor.png`    | La mascota estrella de cuatro puntas con birrete, solo la cara, pensada para un botón redondo.            |

### Pestañas de la materia (128×128, mismo trazo)

| Archivo                   | Prompt                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `icons/tab-summary.png`   | Una brújula con una estrella dorada como aguja. Representa "resumen de la materia". |
| `icons/tab-notes.png`     | Una pila de hojas con un clip dorado. Representa "apuntes".                         |
| `icons/tab-resources.png` | Un matraz y dos tarjetas apiladas. Representa "recursos".                           |
| `icons/tab-pending.png`   | Una lista con tres casillas, una con palomita dorada, y una campana pequeña.        |

### Escenas y pantallas vacías (600×400)

| Archivo                   | Prompt                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `continue-hero.png`       | Un camino de bloques en zigzag que sube con huellas pequeñas y una bandera dorada al final; en medio hay un libro abierto con un marcador dorado. Representa "continúa donde te quedaste". |
| `create-hero.png`         | La mascota estrella dorada sacando tarjetas, un matraz y una lista de un sombrero de copa azul marino, con destellos. Representa "¿qué quieres crear?".                                    |
| `empty-library.png`       | Una estantería vacía y acogedora con una estrella dorada en un estante y una lámpara pequeña.                                                                                              |
| `empty-search.png`        | Una lupa grande inclinada sobre una retícula, con un signo de interrogación como forma geométrica. Representa "no encontré eso".                                                           |
| `empty-subject-notes.png` | Una carpeta abierta vacía con una flecha dorada hacia arriba y una hoja volando hacia ella.                                                                                                |
