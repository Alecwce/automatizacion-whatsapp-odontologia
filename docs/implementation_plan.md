# Plan de Implementación: Fase 4 - Enrutamiento Inteligente (Intent Classifier)

Este plan detalla los cambios técnicos necesarios para implementar la **Fase 4: Enrutamiento Inteligente (Intent Classifier)**. El objetivo es que el bot conversacional odontológico comprenda de forma nativa e inteligente el mensaje inicial en el estado `IDLE`, decidiendo si debe responder una pregunta o iniciar el flujo de agendamiento capturando la fecha de forma inmediata si es provista.

---

## Decisiones de Diseño

1. **Clasificación de Intenciones Iniciales (`src/services/ai.ts`):**
   - Utilizaremos el SDK `@google/generative-ai` y el modelo **`gemini-2.5-flash`**.
   - Crearemos la función `analyzeInitialIntent(userMessage: string)` que devolverá una promesa resolviendo en:
     ```typescript
     interface IntentAnalysis {
       action: 'AGENDAR' | 'PREGUNTA';
       dateIso: string | null;
       reply: string | null;
     }
     ```
   - **System Instruction del Clasificador:**
     - Contexto: Consultorio Odontológico "Clínica Odontológica".
     - Horario de atención: Lunes a Viernes de 8:00 AM a 6:00 PM y Sábados de 8:00 AM a 1:00 PM.
     - Contexto temporal en tiempo real de Bogotá/Colombia.
     - Si la intención es agendar, pedir, consultar disponibilidad para reservar una cita:
       - Retornar `action: "AGENDAR"`.
       - Si especifica fecha/hora, calcularla de forma precisa y retornarla en `dateIso`. Si no indica fecha o si cae fuera del horario de atención, retornar `dateIso: null`.
     - Si la intención es una pregunta informativa (horarios, servicios, ubicación, precios) o simplemente saluda sin intención clara de agendar:
       - Retornar `action: "PREGUNTA"`.
       - Redactar en `reply` una respuesta corta y profesional (máximo 2 oraciones).
     - Restricción estricta de salida: Retornar **únicamente** un JSON válido con la estructura solicitada, libre de bloques de código markdown (\`\`\`json).

2. **Actualización de la FSM conversacional (`src/services/whatsapp.ts`):**
   - En el estado **`IDLE`**:
     - Consumir el mensaje con `analyzeInitialIntent`.
     - Si la acción es `PREGUNTA`: Responder con `reply` y permanecer en `IDLE`.
     - Si la acción es `AGENDAR`:
       - **Si `dateIso` no es `null`**: Guardar la fecha en `session.patientDate`, cambiar el estado a `AWAITING_NAME` y preguntar el nombre completo: *"¡Excelente! Tengo disponibilidad para esa fecha. Para registrar tu cita, ¿cuál es tu nombre completo?"*.
       - **Si `dateIso` es `null`**: Cambiar el estado a `AWAITING_DATE` y preguntar de forma natural por la fecha: *"¡Hola! Claro que sí. ¿Qué día y a qué hora te gustaría agendar tu cita?"*.

3. **Salto de captura de fecha en `AWAITING_DNI`:**
   - En el estado `AWAITING_DNI`, al validar con éxito el DNI:
     - Comprobar si `session.patientDate` ya está definido.
     - **Si ya existe**: Proceder directamente con la persistencia en paralelo mediante `Promise.all` (Sheets + Calendar), confirmar con éxito de forma legible y resetear la sesión a `IDLE` (omitiendo transicionar a `AWAITING_DATE`).
     - **Si NO existe**: Transicionar a `AWAITING_DATE` y solicitar la fecha en lenguaje natural.

---

## Proposed Changes

### 1. Servicios y FSM

#### [MODIFY] [src/services/ai.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/ai.ts)
- Implementar la función `analyzeInitialIntent(userMessage: string)` configurada con una system instruction robusta que devuelva la clasificación e información de agendamiento estructurada en un objeto JSON nativo.

#### [MODIFY] [src/services/whatsapp.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/whatsapp.ts)
- Modificar el flujo del estado `IDLE` para invocar el clasificador y aplicar las decisiones de flujo inteligente (preguntas vs agendamientos directos con fecha).
- Adaptar el estado `AWAITING_DNI` para detectar la presencia previa de `session.patientDate` y realizar el salto de flujo al agendamiento paralelo atómico si ya está definida.

---

### 2. Pruebas Unitarias

#### [MODIFY] [tests/ai.test.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tests/ai.test.ts)
- Añadir pruebas unitarias específicas para `analyzeInitialIntent` verificando la resolución de preguntas, agendamiento con fecha y agendamiento sin fecha de forma aislada.

#### [MODIFY] [tests/fsm.test.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tests/fsm.test.ts)
- Actualizar y mockear las llamadas para dar cobertura al nuevo flujo de salto inteligente asíncrono desde `IDLE`.
- Validar las transiciones cortas: `IDLE` (mensaje inicial con fecha) -> `AWAITING_NAME` -> `AWAITING_DNI` -> Guardado de 5 columnas paralelo atómico Sheets/Calendar -> `IDLE`.

---

## Open Questions

> [!NOTE]
> 1. **Días festivos o domingos:** Si el usuario solicita agendar en un día en el que el consultorio no atiende (ej. domingo), ¿debemos delegarle esa validación a Gemini inyectando las reglas en el prompt o permitimos que se cree de forma abierta en Calendar para que un asesor lo gestione? *(Recomendamos controlarlo desde Gemini indicándole que domingos y fuera del horario de atención el retorno en `dateIso` debe ser null)*.
> 2. **Límite de tiempo de sesión en IDLE:** ¿La sesión del paciente en IDLE se resetea por inactividad? *(El comportamiento por defecto actual de inactividad mantendrá el flujo conversacional en memoria y en IDLE no hay bloqueo por intentos)*.

---

## Verification Plan

### Automated Tests
1. **Pruebas de Clasificador de Intención:** `pnpm test tests/ai.test.ts`
2. **Pruebas de Flujo Inteligente FSM:** `pnpm test tests/fsm.test.ts`
3. **Ejecutar Suite Completa:** `pnpm test`
4. **Validación de Compilación:** `pnpm build`

### Manual Verification
- Iniciar la aplicación (`pnpm dev`).
- **Prueba Informativa:** Escribir al bot: *"¿En qué horario atienden?"* y verificar que responda amigablemente con la información del horario y mantenga el estado en `IDLE`.
- **Prueba Agendamiento Corto:** Escribir al bot: *"Quiero una cita para mañana a las 10:00 am"*. El bot debe responder de inmediato preguntando el nombre. Proporcionar nombre y DNI, confirmando que salta la solicitud de fecha y guarda exitosamente de forma paralela.
- **Prueba Agendamiento Largo:** Escribir al bot: *"Hola, me gustaría agendar una cita"*. El bot debe solicitar la fecha en el paso conversacional clásico de la FSM.
