# Spec: Automatización WhatsApp Odontología

## Objective

El objetivo de este proyecto es construir una aplicación backend CLI en Node.js y TypeScript que automatice la gestión de pacientes de odontología a través de WhatsApp. El sistema escuchará los mensajes entrantes, extraerá información clave del paciente (Nombre y DNI/Cédula) utilizando expresiones regulares (Regex) y palabras clave (sin el uso de Inteligencia Artificial), y registrará estos datos en una hoja de cálculo de Google Sheets.

### User Stories / Casos de Uso
1. **Inicio de Sesión y Conexión:** Como administrador del consultorio, quiero iniciar la aplicación CLI, ver un código QR en la terminal, escanearlo con WhatsApp para autenticar el bot, y que la sesión se guarde localmente para no tener que escanear el código en cada reinicio.
2. **Recepción de Mensajes y Registro:** Como paciente que escribe al consultorio por primera vez, quiero enviar un mensaje con mis datos para que el bot de forma automática extraiga mi Nombre y mi DNI/Cédula, me envíe un mensaje de confirmación en WhatsApp, y registre mis datos de inmediato en la hoja de cálculo de Google Sheets.
3. **Monitoreo CLI:** Como desarrollador/administrador, quiero ver logs claros en la terminal sobre el estado de la conexión, mensajes recibidos, extracciones exitosas y escrituras en Google Sheets.

---

## Tech Stack

- **Entorno de Ejecución:** Node.js (v20+ / ESM nativo)
- **Lenguaje:** TypeScript (v5.x) con tipado estricto (`strict: true`)
- **Gestor de Paquetes:** `pnpm`
- **Core de Mensajería:** `@whiskeysockets/baileys` (Conexión directa con WhatsApp Web socket)
- **Base de Datos:** Google Sheets API (`googleapis` v140+)
- **Variables de Entorno:** `dotenv` para configuración segura.
- **Framework de Pruebas:** `vitest` (Excelente rendimiento y compatibilidad nativa con ESM/TypeScript).

---

## Commands

- **Instalación de dependencias:** `pnpm install`
- **Desarrollo (Modo Watch):** `pnpm dev`
- **Compilación de producción:** `pnpm build`
- **Ejecutar producción compilada:** `pnpm start`
- **Ejecutar Pruebas Unitarias:** `pnpm test`
- **Ejecutar Pruebas con Cobertura:** `pnpm test:coverage`
- **Análisis de Linter:** `pnpm lint`
- **Corrección de Linter:** `pnpm lint:fix`

---

## Project Structure

La estructura se mantendrá extremadamente limpia, simple y modular, manteniendo los archivos por debajo del límite recomendado de 200 líneas.

```
automatizacion-whatsapp-odontologia/
├── .agents/                    # Configuraciones y herramientas de los agentes
├── src/
│   ├── config/                 # Configuración general y variables de entorno
│   │   └── env.ts
│   ├── services/               # Clases y lógica de servicios externos
│   │   ├── whatsapp.ts         # Integración y ciclo de vida de Baileys
│   │   └── sheets.ts           # Cliente e integración de Google Sheets API
│   ├── utils/                  # Utilidades y lógica de extracción pura
│   │   └── parser.ts           # Funciones regex para extraer Nombre y DNI
│   ├── index.ts                # Punto de entrada CLI y coordinación principal
│   └── types.ts                # Definiciones de tipos estrictos compartidos
├── tests/                      # Suite de pruebas unitarias
│   ├── parser.test.ts          # Pruebas de extracción de datos con Regex
│   ├── sheets.test.ts          # Mocks y pruebas del servicio de Google Sheets
│   └── whatsapp.test.ts        # Mocks y pruebas del flujo de WhatsApp
├── .env.example                # Plantilla de configuración
├── SPEC.md                     # Esta especificación
├── tsconfig.json               # Configuración estricta de TypeScript
└── package.json                # Dependencias y scripts
```

---

## Code Style

Seguiremos un estilo TypeScript moderno, declarativo, fuertemente tipado y libre de comentarios redundantes (placeholders). No usaremos `any`.

### Ejemplo de Estilo de Código (Parser de Expresiones Regulares)

```typescript
import { ParsedPatientData } from './types';

const DNI_REGEX = /\b(?:\d{7,10}|[VE]-[0-9]{7,9})\b/; // Soporta DNI numérico común y cédulas con prefijo
const NAME_KEYWORDS = ['me llamo', 'mi nombre es', 'soy', 'nombre:'];

/**
 * Analiza un texto de WhatsApp para extraer el Nombre y DNI/Cédula del paciente.
 */
export function parsePatientMessage(message: string): ParsedPatientData {
  const normalizedMessage = message.trim();
  
  // Extracción del DNI/Cédula
  const dniMatch = normalizedMessage.match(DNI_REGEX);
  const dni = dniMatch ? dniMatch[0] : null;

  // Extracción del Nombre
  let name: string | null = null;
  for (const keyword of NAME_KEYWORDS) {
    const keywordIndex = normalizedMessage.toLowerCase().indexOf(keyword);
    if (keywordIndex !== -1) {
      const remainingText = normalizedMessage.slice(keywordIndex + keyword.length).trim();
      // Tomamos la primera línea o los primeros caracteres hasta un separador o número
      const potentialName = remainingText.split(/[\n,;]|\b\d/)[0].trim();
      if (potentialName.length > 2) {
        name = potentialName;
        break;
      }
    }
  }

  return {
    name: name || null,
    dni: dni || null,
    isValid: Boolean(name && dni),
  };
}
```

---

## Testing Strategy

- **Framework:** `vitest`.
- **Estrategia:**
  - **Pruebas Unitarias (`tests/parser.test.ts`):** Cobertura exhaustiva para el motor de regex de extracción. Evaluará al menos 15 casos de mensajes comunes en español (mensajes ideales, ruidosos, incompletos, sin datos, etc.).
  - **Mocks de Servicios externos (`tests/sheets.test.ts` y `tests/whatsapp.test.ts`):** Simulación de llamadas de API de Google Sheets y del socket de Baileys para validar el flujo del sistema sin realizar conexiones de red reales en los tests.
- **Cobertura Mínima Esperada:** 85% de cobertura de código en lógica central y parser.

---

## Boundaries

- **Always (Siempre hacer):**
  - Mantener los archivos con menos de 200 líneas de código.
  - Asegurar tipado estricto al 100% (sin `any`).
  - Ejecutar y validar que las pruebas pasen localmente antes de proponer cambios finales.
  - Manejar excepciones en las llamadas de API de Google Sheets para evitar caídas del bot de WhatsApp.
- **Ask first (Preguntar primero):**
  - Modificar el flujo de interacción o cambiar el mensaje de bienvenida y confirmación enviado al paciente.
  - Modificar o agregar dependencias adicionales en `package.json`.
  - Agregar nuevas columnas o alterar el formato de la hoja de cálculo de Google Sheets.
- **Never (Nunca hacer):**
  - Subir credenciales reales de Google (`service-account.json` o llaves privadas) ni sesiones de WhatsApp (`auth_info_baileys`) al control de versiones.
  - Incorporar frameworks web (Express, Fastify, NestJS, Hono) para evitar sobrecargar y violar los requerimientos de la aplicación CLI.
  - Utilizar IA (OpenAI/Gemini/etc.) en tiempo de ejecución para extraer datos, manteniendo el runtime local y deterministicamente basado en Regex.

---

## Success Criteria

El proyecto se considerará completo y exitoso si cumple con los siguientes puntos comprobables:
1. **Conexión Exitosa:** Al iniciar con `pnpm dev`, la aplicación CLI muestra el código QR en la terminal si no hay una sesión activa, y se conecta exitosamente a WhatsApp.
2. **Persistencia de Sesión:** Si la aplicación CLI se reinicia una vez autenticada, se reconecta automáticamente en menos de 5 segundos sin pedir escaneo de código QR nuevamente.
3. **Parseo Determinista Exitoso:** El parser Regex extrae correctamente el Nombre y DNI de al menos el 90% de las frases de prueba predefinidas y definidas en los tests unitarios.
4. **Escritura Correcta en Google Sheets:** Al recibir un mensaje que contiene los datos válidos del paciente:
   - El bot responde un mensaje de confirmación por WhatsApp en menos de 3 segundos.
   - El bot registra en una nueva fila en Google Sheets: Fecha/Hora, Número de WhatsApp del Paciente, Nombre y DNI/Cédula.
5. **Robustez CLI:** Si la API de Google Sheets falla (ej. sin conexión de red), el CLI registra el error en consola de manera controlada pero NO detiene el proceso principal de WhatsApp.
6. **Calidad de Código:** Ningún archivo supera las 200 líneas de código, todo el código compila con TypeScript estricto, no contiene comentarios de relleno o placeholders, y las pruebas unitarias pasan con >85% de cobertura.

---

## Open Questions

Para completar la especificación y avanzar a la fase de planificación del desarrollo, por favor aclara los siguientes puntos:

> [!IMPORTANT]
> 1. **Formatos de Mensaje Esperados:** ¿Cómo interactúa el paciente por primera vez? ¿El bot debe enviar un mensaje de bienvenida solicitando los datos si el usuario escribe cualquier cosa (ej: "Hola"), o simplemente asume que el usuario enviará un formato específico desde el inicio?
> 2. **Estructura de la Hoja de Google Sheets:** ¿Cuáles son las columnas exactas que debe tener la hoja de cálculo y en qué orden? Por ejemplo:
>    - Columna A: `Fecha de Registro`
>    - Columna B: `Teléfono`
>    - Columna C: `Nombre Completo`
>    - Columna D: `DNI / Cédula`
> 3. **Método de Autenticación de Google:** ¿Utilizaremos una cuenta de servicio de Google Cloud (`service-account.json`) depositada en la raíz del proyecto (excluida en `.gitignore`), o prefieres configurar los parámetros de Google directamente en variables de entorno (como `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` en el `.env`)?
