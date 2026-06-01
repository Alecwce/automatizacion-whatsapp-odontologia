# Tareas de Implementación: Automatización WhatsApp Odontología

Este documento detalla cada una de las tareas del proyecto bajo un enfoque de desarrollo estructurado, con criterios de aceptación explícitos, pasos de verificación técnica y estimación de alcance de acuerdo al rol de ingeniería de software.

---

## Task 1: Configuración de Entorno e Inicialización de Dependencias

**Description:** Configurar los cimientos del proyecto en TypeScript mediante `pnpm`. Esto incluye el archivo de configuración `tsconfig.json` para soporte ESM estricto, la instalación de dependencias principales y de desarrollo, y un servicio seguro de validación de variables de entorno para que el sistema falle rápido si falta alguna configuración en el archivo `.env`.

**Acceptance criteria:**
- [x] El archivo `package.json` tiene instaladas todas las dependencias con soporte ESM (`type: "module"`) mediante `pnpm`.
- [x] `tsconfig.json` está configurado con `"strict": true` y `"moduleResolution": "NodeNext"`.
- [x] `src/config/env.ts` lee y valida la existencia de `SPREADSHEET_ID` y lanza una excepción descriptiva si no está definido en las variables de entorno.
- [x] Existe un archivo `.env.example` completo en el proyecto.

**Verification:**
- [x] Validar tipo y sintaxis ejecutando: `pnpm tsc --noEmit`
- [x] Confirmar que no hay errores de sintaxis en el archivo de configuración de entorno.

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/config/env.ts`

**Estimated scope:** Small (2-3 archivos de configuración)

---

## Task 2: Definición de Tipos y Motor de Parseo de Mensajes con Regex

**Description:** Implementar la capa de datos abstractos y el analizador de texto basado en expresiones regulares para validar nombres y extraer DNI/Cédula sin necesidad de usar inteligencia artificial en tiempo de ejecución. Escribir pruebas exhaustivas para este parser.

**Acceptance criteria:**
- [x] El archivo `src/types.ts` contiene las interfaces y enums tipados estrictamente para el estado de la FSM (`UserSession`), datos del paciente (`PatientData`), y resultado del parser.
- [x] El archivo `src/utils/parser.ts` tiene funciones puras como `parsePatientDni(text: string): string | null` que utilizan expresiones regulares robustas para detectar formatos como números de 7 a 10 dígitos o cédulas tradicionales con letras.
- [x] `tests/parser.test.ts` evalúa exitosamente un set de al menos 15 casos de mensajes válidos, inválidos, parciales y con ruido comunes en español de WhatsApp.

**Verification:**
- [x] Pruebas unitarias de parser exitosas: `pnpm vitest run tests/parser.test.ts`

**Dependencies:** Task 1

**Files likely touched:**
- `src/types.ts`
- `src/utils/parser.ts`
- `tests/parser.test.ts`

**Estimated scope:** Medium (3 archivos)

---

## Checkpoint 1: Cimientos y Lógica de Datos

- [x] Todas las pruebas de extracción de texto Regex y validaciones pasan con cobertura completa.
- [x] El código compila limpiamente y sin errores de tipado TypeScript.

---

## Task 3: Cliente y Servicio de Google Sheets API

**Description:** Construir el servicio encargado de la persistencia de datos del paciente en la hoja de cálculo de Google Sheets. Se utilizará la autenticación nativa por JWT mediante la Cuenta de Servicio `service-account.json`.

**Acceptance criteria:**
- [x] `src/services/sheets.ts` inicializa la conexión con `googleapis` utilizando el archivo de credenciales de cuenta de servicio `service-account.json`.
- [x] El método `appendPatientData(data: PatientData): Promise<boolean>` añade filas de forma atómica en el orden exacto especificado: `[Fecha/Hora Registro] | [Número Teléfono] | [Nombre del Paciente] | [DNI]`.
- [x] Las celdas se insertan mediante `valueInputOption: "USER_ENTERED"` para asegurar el parseo correcto de tipos y formatos de celdas por parte de Google.
- [x] El servicio maneja errores de red o límites de cuota de la API devolviendo un booleano o lanzando excepciones controladas que no interrumpan la ejecución global del CLI.

**Verification:**
- [x] Mockear la API de Sheets y verificar con pruebas unitarias en `tests/sheets.test.ts` que se envíen los parámetros correctos.
- [x] Ejecutar exitosamente las pruebas: `pnpm vitest run tests/sheets.test.ts`

**Dependencies:** Task 2

**Files likely touched:**
- `src/services/sheets.ts`
- `tests/sheets.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 4: Lógica de FSM y Conexión de WhatsApp con Baileys

**Description:** Implementar el orquestador conversacional que maneja la sesión de cada paciente mediante una Máquina de Estados Finita (FSM) y la conexión reactiva con WhatsApp mediante la librería Baileys.

**Acceptance criteria:**
- [x] `src/services/whatsapp.ts` inicializa el socket de Baileys con persistencia local de autenticación en `auth_info_baileys` e impresión del QR en terminal.
- [x] Implementa un mapa en memoria `Map<string, UserSession>` que maneja los estados `IDLE`, `AWAITING_NAME`, y `AWAITING_DNI` por usuario de forma asíncrona.
- [x] Al recibir un mensaje que parezca saludo en `IDLE` (ej: "hola", "buenos días"), transiciona a `AWAITING_NAME` y solicita el nombre.
- [x] Al recibir la respuesta en `AWAITING_NAME`, guarda el nombre en la sesión, transiciona a `AWAITING_DNI` y solicita el DNI/Cédula.
- [x] Al recibir la respuesta en `AWAITING_DNI`, valida y extrae el DNI. Si es correcto, llama al servicio de Sheets, responde "Registrado" y resetea la sesión a `IDLE`. Si es incorrecto, lo vuelve a pedir amigablemente (límite de 3 intentos antes de resetear).

**Verification:**
- [x] Pruebas unitarias de transiciones de FSM y flujo en `tests/fsm.test.ts` con sockets y sheets mockeados.
- [x] Ejecutar con éxito: `pnpm vitest run tests/fsm.test.ts`

**Dependencies:** Task 3

**Files likely touched:**
- `src/services/whatsapp.ts`
- `tests/fsm.test.ts`

**Estimated scope:** Medium (2-3 archivos)

---

## Task 5: Punto de Entrada CLI y Control de Excepciones Globales

**Description:** Construir el punto de partida principal `src/index.ts` que instancie y ponga en marcha los servicios e integre logs descriptivos en la consola, además de capturar señales del sistema operativo para apagar la aplicación de forma limpia.

**Acceptance criteria:**
- [x] `src/index.ts` inicializa las variables de entorno, el cliente de Sheets y arranca la conexión a WhatsApp de manera asíncrona.
- [x] Captura excepciones globales (`uncaughtException` y `unhandledRejection`) para evitar que el bot CLI crashee si falla de forma inesperada cualquier llamada externa.
- [x] Implementa apagado limpio (Graceful Shutdown) en señales `SIGINT` y `SIGTERM` para cerrar correctamente conexiones y liberar recursos.

**Verification:**
- [x] Compilación de TypeScript exitosa: `pnpm build`
- [x] Confirmar que el bundle final corre sin fallos iniciales ejecutando `pnpm start`.

**Dependencies:** Task 4

**Files likely touched:**
- `src/index.ts`

**Estimated scope:** Small (1 archivo)

---

## Checkpoint 2: Sistema Integrado y Listo para Producción

- [x] Todo el sistema compila de forma limpia y transparente sin errores.
- [x] El suite completo de pruebas unitarias pasa exitosamente: `pnpm test` con >85% de cobertura general.
- [x] Las sesiones persisten correctamente al reiniciar el cliente de WhatsApp sin requerir nuevo QR.

---

# Fase 2: Integración con Google Calendar

## Task 6: Actualizar Configuración y Tipos (Env, Types)

**Description:** Incorporar la variable de entorno `CALENDAR_ID` al validador de configuración y expandir los tipos de la FSM para dar soporte al nuevo estado conversacional de captura de fechas.

**Acceptance criteria:**
- [x] `.env.example` contiene la variable `CALENDAR_ID`.
- [x] `src/config/env.ts` valida en runtime que `CALENDAR_ID` esté presente y no esté vacío.
- [x] `src/types.ts` incorpora `'AWAITING_DATE'` a `SessionState` y la propiedad opcional `patientDate?: Date` a `UserSession`.

**Verification:**
- [x] Validar compilación de tipos con: `pnpm tsc --noEmit`

**Dependencies:** Checkpoint 2

**Files likely touched:**
- `.env.example`
- `src/config/env.ts`
- `src/types.ts`

**Estimated scope:** Small (3 archivos)

---

## Task 7: Lógica del Parser de Fechas

**Description:** Desarrollar el validador y parseador determinista de fecha y hora basándose en expresiones regulares y validaciones de coherencia temporal en español, evitando fechas pasadas.

**Acceptance criteria:**
- [x] `src/utils/parser.ts` implementa la función `parseAppointmentDate(text: string): Date | null`.
- [x] La función valida estrictamente el formato `YYYY-MM-DD HH:mm` y descarta fechas inválidas (ej: 31 de febrero o horas como 26:00).
- [x] La función asegura que la fecha sea futura (no menor a la fecha/hora actual del sistema).
- [x] `tests/parser.test.ts` añade al menos 6 casos de pruebas para verificar el comportamiento correcto e incorrecto.

**Verification:**
- [x] Ejecutar exitosamente las pruebas: `pnpm vitest run tests/parser.test.ts`

**Dependencies:** Task 6

**Files likely touched:**
- `src/utils/parser.ts`
- `tests/parser.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 8: Servicio de Google Calendar

**Description:** Crear el servicio que interactúa con Google Calendar API para agendar citas de 1 hora de duración utilizando la Cuenta de Servicio compartida.

**Acceptance criteria:**
- [x] `src/services/calendar.ts` inicializa de forma lazy el cliente `google.calendar` reutilizando las credenciales de `service-account.json`.
- [x] El método `createAppointment(patientName: string, date: Date): Promise<boolean>` crea correctamente un evento en el ID del calendario provisto.
- [x] El evento tiene exactamente 1 hora de duración (End Date = Start Date + 1 hora) y tiene formato ISO correcto.
- [x] El servicio maneja errores de red o cuotas de API de forma segura.
- [x] `tests/calendar.test.ts` implementa mocks y valida los parámetros de llamada de `calendar.events.insert`.

**Verification:**
- [x] Ejecutar con éxito las pruebas: `pnpm vitest run tests/calendar.test.ts`

**Dependencies:** Task 7

**Files likely touched:**
- `src/services/calendar.ts`
- `tests/calendar.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 9: Integración de la FSM de WhatsApp

**Description:** Integrar el estado `AWAITING_DATE` en la FSM conversacional de WhatsApp, permitiendo capturar el Nombre, el DNI y finalmente la Fecha, persistiendo los datos de forma sincrónica y paralela en Sheets y Calendar.

**Acceptance criteria:**
- [x] `src/services/whatsapp.ts` añade la lógica de transición al estado `AWAITING_DATE` tras procesar un DNI correcto.
- [x] Solicita al usuario ingresar la fecha en el formato indicado y gestiona hasta 3 intentos fallidos antes de cancelar la sesión.
- [x] Al recibir una fecha válida, procesa la inserción en Sheets y Calendar de forma paralela usando `Promise.all` y responde con la confirmación.
- [x] `tests/fsm.test.ts` se actualiza para evaluar la transición al estado `AWAITING_DATE` y mockea las llamadas de persistencia del bot.

**Verification:**
- [x] Ejecutar con éxito las pruebas integradas: `pnpm vitest run tests/fsm.test.ts`

**Dependencies:** Task 8

**Files likely touched:**
- `src/services/whatsapp.ts`
- `tests/fsm.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 10: Punto de Entrada y Compilación de Producción

**Description:** Realizar la verificación integrada del bot CLI con todas sus nuevas dependencias de persistencia paralela de citas y hojas de cálculo y asegurar su resiliencia.

**Acceptance criteria:**
- [x] El compilador `tsc` construye el bundle sin errores.
- [x] El bot CLI arranca con éxito localmente leyendo todas las variables del `.env`.

**Verification:**
- [x] Compilación exitosa en producción: `pnpm build`
- [x] Ejecución de la suite completa de pruebas unitarias integradas: `pnpm test`

**Dependencies:** Task 9

**Files likely touched:**
- `src/index.ts`

**Estimated scope:** Small (1 archivo)

---

## Checkpoint 3: Fase 2 Completada y Lista para Entrega

- [x] Todo el sistema compila de forma limpia y transparente sin errores.
- [x] La suite de pruebas de Vitest pasa con 100% de éxito (mínimo 26 pruebas integradas).
- [x] El bot de WhatsApp agenda citas en Google Calendar y escribe en Google Sheets de forma coordinada y paralela.

---

# Fase 3: Procesamiento de Lenguaje Natural con Gemini AI

## Task 11: Instalar Dependencia Generative AI y Validar API Key

**Description:** Instalar el SDK oficial de Google para inteligencia artificial y configurar y validar de forma estricta la presencia de `GEMINI_API_KEY` en el entorno.

**Acceptance criteria:**
- [x] El SDK `@google/generative-ai` está instalado en `package.json` mediante `pnpm`.
- [x] `src/config/env.ts` incorpora `geminiApiKey` en la interfaz `Config` y en la lógica del validador `validateEnv` lanzando error descriptivo si está ausente.
- [x] `.env.example` incluye la variable de ejemplo `GEMINI_API_KEY`.

**Verification:**
- [x] Validar tipos del compilador: `pnpm tsc --noEmit`

**Dependencies:** Checkpoint 3

**Files likely touched:**
- `package.json`
- `src/config/env.ts`
- `.env.example`

**Estimated scope:** Small (3 archivos)

---

## Task 12: Actualizar Google Sheets para Soportar 5 Columnas

**Description:** Expandir el registro de base de datos de pacientes en la hoja de cálculo de Google Sheets para almacenar una 5ta columna que contenga la fecha/hora reservada de la cita médica, actualizando tipos y tests unitarios.

**Acceptance criteria:**
- [x] `PatientData` en `src/types.ts` incluye la propiedad opcional `appointmentDate?: string`.
- [x] `src/services/sheets.ts` actualiza la inserción en Sheets para añadir un 5to valor en la fila con la fecha de la cita formateada localmente en Bogotá/Colombia.
- [x] `tests/sheets.test.ts` actualiza los mocks y aserciones del API para validar que se inserten 5 valores por fila de forma correcta.

**Verification:**
- [x] Ejecutar exitosamente las pruebas unitarias: `pnpm vitest run tests/sheets.test.ts`

**Dependencies:** Task 11

**Files likely touched:**
- `src/types.ts`
- `src/services/sheets.ts`
- `tests/sheets.test.ts`

**Estimated scope:** Medium (3 archivos)

---

## Task 13: Implementar Servicio de Gemini AI con gemini-2.5-flash

**Description:** Construir el servicio de inteligencia artificial encargado de parsear el lenguaje natural ingresado por el paciente y transformarlo en una fecha estructurada ISO determinista, alimentando la petición con contexto en tiempo real del sistema. La función debe retornar estrictamente el string ISO o null.

**Acceptance criteria:**
- [x] `src/services/ai.ts` inicializa la SDK de Google usando `gemini-2.5-flash` de forma estricta.
- [x] La función `extractDateFromIntent(userMessage: string): Promise<string | null>` inyecta un System Prompt robusto con la fecha y hora actual en tiempo real del sistema para resolver expresiones como "mañana", "el próximo lunes", etc.
- [x] El modelo se configura para retornar exclusivamente un string en formato ISO o la palabra literal `null` si no entiende.
- [x] `tests/ai.test.ts` mockea `@google/generative-ai` y comprueba la resolución de respuestas válidas de Gemini e inputs inválidos/nulos retornando strings en formato ISO o null.

**Verification:**
- [x] Ejecutar exitosamente las pruebas: `pnpm vitest run tests/ai.test.ts`

**Dependencies:** Task 12

**Files likely touched:**
- `src/services/ai.ts`
- `tests/ai.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 14: Integrar Gemini en la FSM de WhatsApp

**Description:** Conectar el servicio conversacional de WhatsApp en la FSM para que solicite la fecha en lenguaje natural al paciente y procese la respuesta a través del servicio de IA, persistiendo en Sheets y Calendar de manera sincrónica paralela.

**Acceptance criteria:**
- [x] `src/services/whatsapp.ts` actualiza la pregunta al paciente de fecha a algo amigable y conversacional (sin formatos).
- [x] El caso `AWAITING_DATE` procesa el texto con `extractDateFromIntent` y maneja su retorno de tipo `string | null`.
- [x] Si se detecta fecha correcta, persiste los datos en Sheets (con 5 columnas) y Calendar en paralelo usando `Promise.all` e informa amigablemente al usuario.
- [x] `tests/fsm.test.ts` se actualiza para mockear las llamadas de IA de Baileys y Google Sheets/Calendar de acuerdo al nuevo formato string de retorno.

**Verification:**
- [x] Ejecutar exitosamente las pruebas integradas: `pnpm vitest run tests/fsm.test.ts`

**Dependencies:** Task 13

**Files likely touched:**
- `src/services/whatsapp.ts`
- `tests/fsm.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 15: Verificación Integrada Final y Bundle de Producción

**Description:** Garantizar la calidad, compilación y empaquetado final de todo el sistema integrado con soporte multicanal de persistencia de citas de lenguaje natural.

**Acceptance criteria:**
- [x] El suite completo de pruebas unitarias de regresión pasa con 100% de éxito en Vitest.
- [x] El compilador TypeScript construye el bundle final de producción en `dist/` de forma exitosa y sin fallos de compilación.

**Verification:**
- [x] Compilación de producción: `pnpm build`
- [x] Ejecución de la suite completa de pruebas unitarias: `pnpm test`

**Dependencies:** Task 14

**Files likely touched:**
- `src/index.ts`

**Estimated scope:** Small (1 archivo)

---

## Checkpoint 4: Sistema Completo e Inteligente Listo para Producción

- [x] Todo el sistema compila de forma limpia y transparente sin errores.
- [x] La suite de pruebas de Vitest pasa con 100% de éxito.
- [x] El bot de WhatsApp procesa lenguaje natural para agendar citas en Google Calendar y registrar en 5 columnas en Google Sheets de forma coordinada y paralela.

---

# Fase 4: Enrutamiento Inteligente (Intent Classifier)

## Task 16: Clasificador de Intención Inicial en Gemini

**Description:** Desarrollar e implementar la función `analyzeInitialIntent` en `src/services/ai.ts` utilizando `gemini-2.5-flash`. El prompt debe clasificar la intención del usuario en `AGENDAR` o `PREGUNTA`. Se deben inyectar las reglas del horario de atención del consultorio: Lunes a Viernes de 9:00 AM a 1:00 PM y de 3:00 PM a 7:00 PM, Sábados de 9:00 AM a 1:00 PM, Domingos cerrado. Si se solicita fuera de horario o domingos, el campo `dateIso` debe ser `null`. Retornar estrictamente JSON nativo.

**Acceptance criteria:**
- [x] La función `analyzeInitialIntent(userMessage: string)` está declarada en `src/services/ai.ts` y exportada correctamente.
- [x] Inyecta el System Prompt estructurado con la fecha/hora en tiempo real del servidor y las reglas estrictas de horarios.
- [x] Retorna una promesa con un JSON tipado conteniendo `action`, `dateIso` y `reply`.
- [x] No incluye bloques de código markdown y maneja errores de parseo de forma resiliente.

**Verification:**
- [x] Ejecutar compilación de tipos: `pnpm tsc --noEmit`

**Dependencies:** Checkpoint 4

**Files likely touched:**
- `src/services/ai.ts`

**Estimated scope:** Medium (1 archivo)

---

## Task 17: Modificar FSM para Enrutamiento y Salto Inteligente

**Description:** Actualizar el flujo de la Máquina de Estados (FSM) conversacional en `src/services/whatsapp.ts`. En el estado `IDLE`, invocar al clasificador de intenciones. Responder de inmediato en `IDLE` si es `PREGUNTA`. Si es `AGENDAR`, decidir entre salto inteligente a `AWAITING_NAME` o flujo clásico `AWAITING_DATE`. Adaptar `AWAITING_DNI` para saltar a persistencia paralela si la fecha ya está en sesión.

**Acceptance criteria:**
- [x] El estado `IDLE` evalúa el intent con `analyzeInitialIntent`.
- [x] Si es `PREGUNTA`, responde y permanece en `IDLE`.
- [x] Si es `AGENDAR` con fecha, la guarda, pasa a `AWAITING_NAME` y pregunta por el nombre.
- [x] Si es `AGENDAR` sin fecha, pasa a `AWAITING_DATE` y pregunta por la fecha.
- [x] El estado `AWAITING_DNI` valida que si `session.patientDate` existe, guarda atómicamente en Sheets y Calendar en paralelo y vuelve a `IDLE`.

**Verification:**
- [x] Ejecutar compilador sin emitir: `pnpm tsc --noEmit`

**Dependencies:** Task 16

**Files likely touched:**
- `src/services/whatsapp.ts`

**Estimated scope:** Large (1 archivo)

---

## Task 18: Pruebas Unitarias del Clasificador

**Description:** Añadir soporte en la suite de pruebas unitarias de IA en `tests/ai.test.ts` para evaluar el clasificador de intenciones `analyzeInitialIntent` simulando llamadas exitosas de Gemini con mocks coherentes.

**Acceptance criteria:**
- [x] `tests/ai.test.ts` añade al menos 3 casos de prueba para `analyzeInitialIntent` (pregunta general, agendamiento de cita en horario hábil y agendamiento de cita fuera de horario).
- [x] Los mocks de Google Generative AI se adaptan para devolver objetos de respuesta JSON coherentes simulados.

**Verification:**
- [x] Ejecutar pruebas específicas de IA: `pnpm vitest run tests/ai.test.ts`

**Dependencies:** Task 17

**Files likely touched:**
- `tests/ai.test.ts`

**Estimated scope:** Medium (1 archivo)

---

## Task 19: Pruebas de Integración de FSM con Enrutamiento

**Description:** Actualizar `tests/fsm.test.ts` para mockear `analyzeInitialIntent` and dar cobertura al nuevo flujo de salto inteligente de agendamiento y enrutamiento a preguntas desde el estado `IDLE`.

**Acceptance criteria:**
- [x] El mock del servicio de IA en `tests/fsm.test.ts` incorpora `analyzeInitialIntent`.
- [x] Evalúa exitosamente el flujo corto: `IDLE` (con fecha inicial) -> `AWAITING_NAME` -> `AWAITING_DNI` -> Guardado de 5 columnas paralelo atómico -> `IDLE`.
- [x] Evalúa que las preguntas de consulta al bot respondan y mantengan la sesión en `IDLE`.

**Verification:**
- [x] Ejecutar pruebas específicas de FSM: `pnpm vitest run tests/fsm.test.ts`

**Dependencies:** Task 18

**Files likely touched:**
- `tests/fsm.test.ts`

**Estimated scope:** Large (1 archivo)

---

## Task 20: Compilación y Verificación Final

**Description:** Ejecutar la suite completa de pruebas unitarias de regresión y empaquetar el proyecto de producción final libre de cualquier error.

**Acceptance criteria:**
- [x] Todas las pruebas de Vitest superan exitosamente el 100%.
- [x] La compilación con `tsc` no produce ningún error.

**Verification:**
- [x] Compilación de producción: `pnpm build`
- [x] Ejecución de la suite completa de pruebas unitarias: `pnpm test`

**Dependencies:** Task 19

**Files likely touched:**
- `src/index.ts`

**Estimated scope:** Small (1 archivo)

---

## Checkpoint 5: Fase 4 Completada y Lista para Entrega

- [x] Todo el sistema compila de forma limpia y transparente sin errores.
- [x] La suite de pruebas# Fase 5: Validación de Disponibilidad (Anti-Choques)

## Task 21: Actualizar Prompt de IA en ai.ts

**Description:** Modificar el System Prompt de `analyzeInitialIntent` en `src/services/ai.ts`. Incorporar la regla de que si el usuario solicita agendar en horario no laboral o domingos, la acción sea `PREGUNTA` y el `reply` explique el horario y sugiera elegir otra fecha. Añadir también la regla de que los mensajes de cortesía/despedida se clasifiquen como `PREGUNTA` y den una cortesía en `reply` manteniéndose en `IDLE`.

**Acceptance criteria:**
- [x] System Prompt en `src/services/ai.ts` actualizado con las nuevas reglas.
- [x] Los mensajes de despedida/cortesía y los agendamientos fuera de horario retornan la acción `PREGUNTA` con sus textos descriptivos en el JSON.

**Verification:**
- [x] Validar compilación de tipos: `pnpm tsc --noEmit`

**Dependencies:** Checkpoint 5

**Files likely touched:**
- `src/services/ai.ts`

**Estimated scope:** Medium (1 archivo)

---

## Task 22: checkAvailability en calendar.ts

**Description:** Implementar la función `checkAvailability(date: Date): Promise<boolean>` en `src/services/calendar.ts` utilizando `calendar.events.list`. Debe buscar superposiciones restando 1 segundo del `timeMax` para evitar falsos positivos con citas adyacentes y retornar `true` si está libre (0 eventos) o `false` si está ocupado.

**Acceptance criteria:**
- [x] Función `checkAvailability` declarada y exportada en `src/services/calendar.ts`.
- [x] Consulta la API de Calendar con `timeMin` y `timeMax` (menos 1 segundo) con `singleEvents: true` de forma atómica.
- [x] Retorna `true` ante 0 colisiones, y `false` en caso contrario.

**Verification:**
- [x] Validar tipos: `pnpm tsc --noEmit`

**Dependencies:** Task 21

**Files likely touched:**
- `src/services/calendar.ts`

**Estimated scope:** Medium (1 archivo)

---

## Task 23: Integrar checkAvailability en whatsapp.ts

**Description:** Integrar la validación de disponibilidad previa al guardado en los estados `AWAITING_DNI` (flujo de atajo inteligente) y `AWAITING_DATE` (flujo clásico). Si está ocupado, debe redirigir al usuario al estado `AWAITING_DATE` y solicitar amigablemente otra fecha/hora sin guardar datos.

**Acceptance criteria:**
- [x] `AWAITING_DNI` invoca `checkAvailability` si hay fecha y redirige amigablemente a `AWAITING_DATE` si está ocupado.
- [x] `AWAITING_DATE` invoca `checkAvailability` y solicita otra fecha si está ocupado.
- [x] Solo se persiste en Sheets y Calendar si la disponibilidad retorna libre.

**Verification:**
- [x] Validar tipos: `pnpm tsc --noEmit`

**Dependencies:** Task 22

**Files likely touched:**
- `src/services/whatsapp.ts`

**Estimated scope:** Large (1 archivo)

---

## Task 24: Actualizar Pruebas Unitarias de IA y Calendar

**Description:** Actualizar `tests/ai.test.ts` para validar los nuevos intents de cortesía e inactividad laboral. Actualizar `tests/calendar.test.ts` mockeando `events.list` para dar cobertura a la comprobación de disponibilidad.

**Acceptance criteria:**
- [x] `tests/ai.test.ts` aserta que agendamientos en domingos y cortesías sean `PREGUNTA` con sus replies.
- [x] `tests/calendar.test.ts` comprueba los retornos `true` y `false` de disponibilidad.

**Verification:**
- [x] Ejecutar pruebas de IA: `pnpm vitest run tests/ai.test.ts`
- [x] Ejecutar pruebas de Calendar: `pnpm vitest run tests/calendar.test.ts`

**Dependencies:** Task 23

**Files likely touched:**
- `tests/ai.test.ts`
- `tests/calendar.test.ts`

**Estimated scope:** Medium (2 archivos)

---

## Task 25: Actualizar Pruebas FSM y Correr Suite Completa

**Description:** Modificar `tests/fsm.test.ts` para mockear la disponibilidad de Google Calendar y añadir cobertura ante un rechazo por colisión de horarios y respuestas cortas de cortesía desde `IDLE`.

**Acceptance criteria:**
- [x] Las pruebas de Vitest cubren el flujo de colisión de horarios y respuestas en `IDLE` de cortesía.
- [x] Toda la suite de Vitest (mínimo 42 pruebas) pasa exitosamente.
- [x] La compilación final del bundle corre limpia.

**Verification:**
- [x] Compilación final: `pnpm build`
- [x] Ejecución de la suite completa: `pnpm test`

**Dependencies:** Task 24

**Files likely touched:**
- `tests/fsm.test.ts`

**Estimated scope:** Large (1 archivo)

---

## Checkpoint 6: Sistema Completo con Validación Anti-Choques Listo para Producción

- [x] Todo el sistema compila de forma limpia y transparente sin errores.
- [x] La suite de pruebas de Vitest pasa con 100% de éxito.
- [x] El bot de WhatsApp impide colisiones de horarios en tiempo real y rutea y asiste al usuario de forma sumamente inteligente.

