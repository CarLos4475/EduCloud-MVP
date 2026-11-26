# Sistema de diseño de Mi Campus

Estilo Block & Bold: bloques con borde, sombra dura dorada y azul marino sobre papel claro. Los valores viven como tokens en el bloque `:root` de `apps/web/src/styles/main.css`; `study.css` y los componentes nuevos los usan en lugar de valores sueltos. El kit de los interactivos (`apps/renderer/src/sandbox/kit.css`) tiene su propio juego de tokens porque corre en un origen aislado, con los mismos colores base.

| Grupo      | Tokens                                                                                                              | Uso                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Color      | `--navy`, `--gold`, `--paper`, `--sand`, `--cream`, `--ink`, `--muted`                                              | Base: texto y bordes azul marino, acento oro, fondos papel/crema |
| Estado     | `--good`, `--good-bg`, `--bad`, `--bad-bg`, `--bad-ink`                                                             | Aciertos, errores y avisos                                       |
| Tipo       | `--font-body`, `--font-display`, `--font-mono`; `--text-xs` a `--text-lg`                                           | Cuerpo condensado, títulos en slab, datos en mono                |
| Espaciado  | `--space-1` a `--space-6` (4, 8, 12, 16, 24, 36 px)                                                                 | Separaciones y rellenos nuevos                                   |
| Bloque     | `--border`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-navy-sm`, `--focus`                              | Tarjetas, botones y foco visible                                 |
| Movimiento | `--ease`, `--t-fast`, `--t-mid`                                                                                     | Transiciones; se desactivan con `prefers-reduced-motion`         |
| Tipos      | `[data-kind="…"]` define `--kind` (resumen, conceptos, tarjetas, cuestionario, ejercicios, conexiones, experimento) | Franja y punto de color; nunca el color del texto                |

## Reglas

- El color nunca es la única señal: siempre hay texto o ícono además del acento.
- El texto normal cumple contraste AA (la auditoría automática de `tests/e2e/accessibility.spec.ts` revisa inicio, biblioteca, calendario, materia, hoja de crear y paleta).
- Estados de espera con esqueletos, no spinners.
- Sin proveedores ni jerga técnica en textos para estudiantes.
- Un valor nuevo se agrega primero como token y luego se usa; no se repiten hexadecimales en los componentes.

## Estado

Los colores, sombras y tipografías repetidas de `main.css` y `study.css` ya se refieren a tokens. La escala de espaciado y los tamaños de texto están definidos y se aplican a lo nuevo; los rellenos antiguos de `study.css` se migran de forma gradual al tocar cada componente.
