# Plan de Implementación: Fase 5 - Validación de Disponibilidad (Anti-Choques)

Este plan detalla los cambios técnicos necesarios para implementar la **Fase 5: Validación de Disponibilidad (Anti-Choques)** y las **Mejoras UX en la Clasificación de Intenciones** de la IA. El objetivo es que el bot impida de forma activa los choques de citas en Google Calendar y brinde una experiencia fluida al usuario si solicita agendar fuera del horario comercial o envía mensajes de cortesía.

---

## Decisiones de Diseño

### A. Mejoras en la Clasificación de Intenciones (`src/services/ai.ts`):
1. **Regla de Horario no Laboral:**
   - Si el usuario solicita agendar una cita en un día u hora no laboral (ej. un domingo o de madrugada), Gemini ya no debe clasificar como `AGENDAR` con `dateIso: null`.
   - En su lugar, debe clasificarlo como **`PREGUNTA`**, y en el campo `reply` debe redactar una respuesta profesional explicando amablemente el horario laboral e invitando a elegir otra fecha hábil.
2. **Regla de Despedidas y Cortesía:**
   - Si el usuario envía mensajes de despedida, confirmación simple o agradecimiento (ej. *"gracias"*, *"vale"*, *"ok"*, *"perfecto"*, *"chao"*), Gemini debe clasificarlo como **`PREGUNTA`**.
   - En el campo `reply` debe redactar una despedida cortés (ej. *"¡Gracias a ti! Que tengas un excelente día."*), libre de nuevas preguntas o llamados a la acción, y la FSM responderá manteniéndose en el estado `IDLE`.

### B. Fase 5: Validación Anti-Choques (`src/services/calendar.ts` y `whatsapp.ts`):
1. **Servicio de Disponibilidad (`src/services/calendar.ts`):**
   - Implementaremos la función `checkAvailability(date: Date): Promise<boolean>`.
   - Utilizaremos `calendar.events.list` sobre el `CALENDAR_ID` pasando:
     - `timeMin`: La fecha solicitada en formato ISO.
     - `timeMax`: La fecha solicitada más 1 hora (menos 1 segundo) en formato ISO, para evitar choques falsos positivos con citas consecutivas.
     - `singleEvents: true` para desglosar eventos recurrentes.
     - `maxResults: 1`.
   - Si la API de Calendar devuelve `items` con longitud mayor a 0, significa que el espacio está ocupado (`return false`). Si devuelve 0 items, está libre (`return true`).
2. **Integración en la FSM (`src/services/whatsapp.ts`):**
   - En los estados `AWAITING_DNI` (flujo corto con fecha pre-capturada) y `AWAITING_DATE` (flujo clásico), justo antes de realizar la persistencia paralela en Sheets y Calendar, se invocará `await checkAvailability(parsedDate)`.
   - **Si está libre (`true`)**: Continúa con el flujo normal de persistencia paralela en Sheets y Calendar mediante `Promise.all`.
   - **Si está ocupado (`false`)**:
     - No se realiza ninguna persistencia (Sheets ni Calendar se tocan).
     - La FSM transiciona/mantiene el estado a `AWAITING_DATE` y restablece los intentos.
     - Responde amigablemente al paciente en WhatsApp: *"Lo siento mucho, pero ese horario ya se encuentra reservado. ¿Podrías indicarme otro día u hora que te quede bien?"*.

---

## Proposed Changes

### 1. Servicios y FSM

#### [MODIFY] [src/services/ai.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/ai.ts)
- Actualizar el System Prompt de `analyzeInitialIntent` incorporando las nuevas reglas estrictas para clasificar como `PREGUNTA` las solicitudes fuera de horario comercial y los mensajes de cortesía/despedida.

#### [MODIFY] [src/services/calendar.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/calendar.ts)
- Implementar y exportar la función `checkAvailability(date: Date): Promise<boolean>` con validación de rango de superposición exacta.

#### [MODIFY] [src/services/whatsapp.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/whatsapp.ts)
- Integrar la comprobación de `checkAvailability` previa a las inserciones paralelas en los estados `AWAITING_DNI` y `AWAITING_DATE`, aplicando el flujo de rechazo amigable y redirección de fecha.

---

### 2. Pruebas Unitarias

#### [MODIFY] [tests/calendar.test.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tests/calendar.test.ts)
- Mockear `events.list` en la API de Google Calendar y añadir pruebas específicas para validar el retorno `true` (libre) y `false` (ocupado).

#### [MODIFY] [tests/ai.test.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tests/ai.test.ts)
- Actualizar las pruebas para evaluar que las peticiones fuera de horario y los mensajes de cortesía se clasifiquen exitosamente como `PREGUNTA` con sus correspondientes textos en `reply`.

#### [MODIFY] [tests/fsm.test.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tests/fsm.test.ts)
- Mockear `checkAvailability` y añadir casos de prueba para evaluar la FSM ante un rechazo por choque de horarios y el comportamiento de las respuestas en `IDLE` de cortesía.

---

## Open Questions

> [!NOTE]
> 1. **Diferencia horaria local y servidor:** Nos aseguramos de consultar a Google Calendar utilizando fechas estándar en formato ISO `toISOString()`. Dado que se especifica `timeZone: 'America/Bogota'` en la inserción, el cálculo de superposición es totalmente consistente independientemente del servidor.
> 2. **¿Existe tolerancia de superposición?:** Citas consecutivas de 10:00 a 11:00 y de 11:00 a 12:00 no deben chocar. (Resuelto: Al restar 1 segundo de `timeMax` aseguramos que el rango de consulta de la primera sea de `10:00:00` a `10:59:59`, evitando cualquier coincidencia límite).

---

## Verification Plan

### Automated Tests
1. **Pruebas de Disponibilidad en Calendar:** `pnpm test tests/calendar.test.ts`
2. **Pruebas de Cortesía e Intención en IA:** `pnpm test tests/ai.test.ts`
3. **Pruebas de Choques en FSM:** `pnpm test tests/fsm.test.ts`
4. **Ejecutar Suite Completa:** `pnpm test`
5. **Verificación de Compilación:** `pnpm build`

### Manual Verification
- Iniciar la aplicación (`pnpm dev`).
- **Prueba Fuera de Horario Inicial:** Escribir al bot: *"Quiero cita el domingo a las 10 am"*. El bot debe responder conversacionalmente explicando los horarios y quedarse en `IDLE`.
- **Prueba Cortesía:** Escribir al bot: *"Perfecto, gracias"*. El bot debe responder *"¡Gracias a ti! Que tengas un excelente día."* sin hacer más preguntas.
- **Prueba Choque de Citas:** 
  - Registrar una cita ficticia en Google Calendar el día de mañana a las 11:00 AM.
  - Escribir al bot solicitando una cita para mañana a las 11:00 AM.
  - El bot debe detectar el choque y responder solicitando amigablemente otra fecha/hora.
