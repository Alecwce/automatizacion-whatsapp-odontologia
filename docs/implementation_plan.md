# Plan de Implementación: Automatización WhatsApp Odontología

Este plan detalla el enfoque técnico para construir un bot conversacional CLI para WhatsApp que interactúa con pacientes mediante una Máquina de Estados Finita (FSM) y registra sus datos (Nombre, DNI) en una hoja de Google Sheets.

## Contexto y Decisiones de Diseño

1. **Máquina de Estados de Sesión (FSM):**
   - Usaremos un mapa en memoria (`Map<string, UserSession>`) indexado por el identificador de WhatsApp del paciente (`jid`).
   - Las sesiones tendrán tres estados posibles:
     - `IDLE`: Esperando cualquier saludo (ej. "hola", "buenas"). Envía la bienvenida y solicita el nombre completo. Transición a `AWAITING_NAME`.
     - `AWAITING_NAME`: Espera la respuesta con el nombre. Si el texto es válido, lo almacena en la sesión temporal y solicita el DNI/Cédula. Transición a `AWAITING_DNI`.
     - `AWAITING_DNI`: Intenta extraer el DNI del texto con Regex. Si es válido, guarda en Sheets, confirma al paciente con un mensaje y restablece a `IDLE`. Si no es válido, vuelve a solicitar el DNI (máximo 3 intentos antes de reiniciar a `IDLE`).

2. **Servicio Google Sheets:**
   - Carga la cuenta de servicio desde `service-account.json`.
   - Utiliza la clase `JWT` de `google-auth-library` para autenticar peticiones sin redirecciones de usuario.
   - Utiliza `sheets.spreadsheets.values.append` con `valueInputOption: 'USER_ENTERED'` para insertar filas al final de la tabla de forma atómica.

3. **Servicio WhatsApp (`@whiskeysockets/baileys`):**
   - Utiliza `useMultiFileAuthState('auth_info_baileys')` para persistir la sesión de WhatsApp de forma local y segura.
   - Escucha los eventos de conexión para reconectar automáticamente mediante el manejo de errores provisto por `@hapi/boom` y `DisconnectReason`.
   - Captura eventos de mensajería `messages.upsert` para procesar los mensajes en el flujo de la FSM.

---

## User Review Required

> [!WARNING]
> **Persistencia de Estados de Sesión:** Dado que la FSM se mantiene en memoria, si la aplicación CLI se reinicia, las conversaciones que estén a mitad de proceso (ej. esperando DNI) volverán al estado `IDLE`. Para un bot sencillo este enfoque es óptimo y mantiene la complejidad baja. ¿Estás de acuerdo con este enfoque en memoria, o prefieres una persistencia local simple en un archivo JSON para las sesiones activas?

---

## Proposed Changes

### 1. Configuración y Dependencias

#### [MODIFY] [package.json](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/package.json)
- Instalar dependencias necesarias: `@whiskeysockets/baileys`, `googleapis`, `dotenv`, `qrcode-terminal`, `@hapi/boom`.
- Instalar dependencias de desarrollo: `typescript`, `vitest`, `tsx` (para ejecutar TS en desarrollo), `@types/node`.
- Agregar scripts: `dev`, `build`, `start`, `test`, `lint`.

#### [NEW] [tsconfig.json](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/tsconfig.json)
- Configuración estricta de TypeScript compatible con Node.js ESM.

#### [NEW] [.env.example](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/.env.example)
- Declarar variables necesarias: `SPREADSHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (opcional, por defecto `service-account.json`).

---

### 2. Estructura de Tipos y Parsers

#### [NEW] [types.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/types.ts)
- Definición de tipos para el FSM, sesiones de usuario y estructuras de datos de pacientes.

```typescript
export type SessionState = 'IDLE' | 'AWAITING_NAME' | 'AWAITING_DNI';

export interface UserSession {
  state: SessionState;
  patientName?: string;
  patientDni?: string;
  attempts: number;
  lastInteraction: Date;
}

export interface PatientData {
  timestamp: string;
  phone: string;
  name: string;
  dni: string;
}

export interface ParserResult {
  extractedValue: string | null;
  isValid: boolean;
}
```

#### [NEW] [parser.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/utils/parser.ts)
- Funciones puras para limpiar y parsear mensajes.
- Métodos para validar nombres (no vacíos, caracteres válidos) y DNI/Cédulas (expresiones regulares).

---

### 3. Servicios Principales

#### [NEW] [env.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/config/env.ts)
- Carga y validación en runtime de variables de entorno mediante `dotenv` y aserciones estrictas.

#### [NEW] [sheets.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/sheets.ts)
- Inicialización del cliente de Google Sheets con `JWT` de `google-auth-library`.
- Método `appendPatientData(data: PatientData): Promise<boolean>`.

#### [NEW] [whatsapp.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/services/whatsapp.ts)
- Conexión e inicialización de Baileys.
- Manejo de QR, credenciales (`creds.update`) y reconexión automática.
- Procesamiento de mensajes entrantes delegando el flujo de estados a la FSM.

---

### 4. Punto de Entrada

#### [NEW] [index.ts](file:///c:/Users/Alexwce/Documents/Dev/automatizacion-whatsapp-odontologia/src/index.ts)
- Orquestación inicial del sistema, inicialización del servicio de Sheets, y arranque de la conexión de WhatsApp.

---

## Verification Plan

### Automated Tests
1. **Pruebas de Parser (`tests/parser.test.ts`):**
   - Validar extracción de DNI comunes (ej. `12345678`, `V-12345678`).
   - Validar extracción e identificación de nombres.
   - Ejecución: `pnpm test tests/parser.test.ts`

2. **Pruebas de FSM (`tests/fsm.test.ts`):**
   - Mockear respuestas de WhatsApp y Google Sheets.
   - Validar transiciones de estados ante saludos, ingreso de nombres y envío de DNI válidos/inválidos.

### Manual Verification
1. **Verificación CLI:**
   - Iniciar la aplicación (`pnpm dev`).
   - Escanear el código QR en la terminal.
   - Verificar la creación del directorio `auth_info_baileys`.
2. **Pruebas End-to-End en WhatsApp:**
   - Enviar un saludo desde un teléfono móvil.
   - Responder al bot con nombre y luego DNI.
   - Verificar la escritura correspondiente en Google Sheets.
