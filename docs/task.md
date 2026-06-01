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
