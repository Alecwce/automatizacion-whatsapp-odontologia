# 🦷 Asistente Virtual Odontológico con IA Híbrida (FSM + Gemini)

Un bot de WhatsApp autónomo diseñado para clínicas odontológicas. Automatiza el agendamiento de citas procesando lenguaje natural, validando la disponibilidad en tiempo real para evitar *overbooking* (choques de horario) y manteniendo un registro atómico en la nube.

## 🚀 Arquitectura y Enfoque (IA Híbrida)

A diferencia de los wrappers tradicionales de ChatGPT que delegan todo el flujo a la IA (resultando en latencia alta y alucinaciones), este proyecto implementa una **Arquitectura Híbrida**:
1. **Inteligencia en el Borde (Gemini 2.5 Flash):** Se encarga exclusivamente de la comprensión del lenguaje natural (NLP). Clasifica intenciones y extrae fechas relativas complejas mediante el uso de un *System Prompt* inyectado con una referencia dinámica del calendario local para evitar alucinaciones temporales.
2. **Máquina de Estados Finita (FSM):** Una vez entendida la intención, el control del flujo pasa a un motor FSM estricto, determinista y tipado en TypeScript. Esto garantiza velocidad y cero alucinaciones durante la recolección de datos sensibles.

## ✨ Características Principales

* **Procesamiento de Lenguaje Natural:** Comprende variaciones, errores ortográficos y expresiones relativas.
* **Validación Anti-Overbooking en Tiempo Real:** Consulta la API de Google Calendar antes de confirmar.
* **Persistencia Atómica y Paralela:** Escribe de forma concurrente (`Promise.all`) en Google Calendar y Google Sheets.
* **Restricciones de Horario Laboral:** Rechaza automáticamente solicitudes fuera de horario.

## 🛠️ Stack Tecnológico

* **Lenguaje:** TypeScript
* **Plataforma:** Baileys (WhatsApp WebSockets)
* **IA:** `@google/generative-ai` (Gemini 2.5 Flash)
* **APIs:** Google Sheets API v4 y Google Calendar API v3
* **Testing:** Vitest

## 🔧 Instalación y Uso Local

1. Clona el repositorio y ejecuta `pnpm install`.
2. Configura las credenciales en `service-account.json`.
3. Crea tu `.env` basado en `.env.example`.
4. Ejecuta `pnpm dev` y escanea el código QR en la terminal.
