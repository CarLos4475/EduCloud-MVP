# EduCloud

Proyecto final de **Cómputo en la Nube** de la Licenciatura en Matemáticas Aplicadas y Computación, FES Acatlán, UNAM.

**Eje temático:** aprendizaje universitario personalizado con datos, aprendizaje automático e inteligencia artificial.

## ¿Qué problema queremos resolver?

Al estudiar para una materia, es común tener los apuntes en un archivo, los pendientes en otro lugar y las dudas en un chat. Cuando toca retomar el tema, hay que volver a buscar todo. Pensamos EduCloud para estudiantes universitarios de ciencias físico-matemáticas e ingeniería que quieren organizar el semestre y estudiar con el material que ya usan en clase.

## ¿Qué se puede hacer hoy?

En el [MVP público de EduCloud](https://educloud-mvp.vercel.app), crea un espacio y elige **Ver apuntes de Circuitos eléctricos**. Pregúntale al tutor qué pasa con la corriente cuando aumenta la resistencia y abre la cita del apunte sobre la ley de Ohm. Resuelve la práctica y elige **Ver tu progreso** para consultar tu resultado. El calendario está disponible desde el menú.

El tutor responde con DeepSeek. En **Recursos**, el botón **Crear recurso** usa el apunte de la ley de Ohm para generar un reto en el que puedes mover la resistencia y ver cómo cambia la corriente. El reto y el avance se guardan en el navegador. El selector de archivos muestra el nombre y el tamaño del archivo que eliges.

## ¿Cómo usaríamos datos, ML e IA?

- **Datos.** Las materias, los apuntes y los intentos de práctica permiten mostrar qué ha repasado cada estudiante y en qué temas aún comete errores.
- **Aprendizaje automático.** Con un historial suficiente, probaríamos un modelo en BigQuery ML para sugerir qué tema conviene repasar. Compararíamos sus sugerencias con las reglas que usa el MVP.
- **Inteligencia artificial.** El tutor explica a partir de los apuntes y cita el fragmento que usó. Para la versión completa, Cloud Vision sería una opción para leer texto de apuntes escaneados.

## La nube que proponemos

La versión que se puede abrir hoy está en Vercel. Para una versión con cuentas y archivos propios, planteamos esta arquitectura en Google Cloud:

| Servicio | Qué haría en EduCloud |
| --- | --- |
| Firebase Hosting y Authentication | Publicar la web y verificar el acceso con correo institucional. |
| Cloud Run | Atender las solicitudes y procesar apuntes sin administrar un servidor propio. |
| Cloud Storage | Guardar los archivos en privado para que cada estudiante pueda consultar los suyos. |
| Firestore | Consultar materias, pendientes y conversaciones sin tener que abrir los documentos. |
| Cloud Tasks | Poner en fila los archivos por procesar mientras el estudiante sigue usando la página. |
| BigQuery y BigQuery ML | Analizar los resultados de práctica y probar recomendaciones de repaso. |

## ¿Cómo sabríamos si ayuda?

En un piloto con estudiantes de Acatlán, les pediríamos localizar un apunte, aclarar una duda y guardar una práctica. Compararíamos cuánto tardan con EduCloud y con las herramientas que ya usan. También revisaríamos si pueden encontrar el fragmento que respalda la respuesta del tutor.

[Presentación](https://educloud-mvp.vercel.app/pitch) · [Primera entrega del proyecto](docs/academico/primera-entrega/educloud-primera-entrega.pdf) · [Guía de desarrollo local](docs/runbooks/desarrollo-local.md)
