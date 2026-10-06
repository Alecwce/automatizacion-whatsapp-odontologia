# Informe de Arquitectura Económica y Estimación de Costos: Caso Clínica Dental

Este documento presenta el análisis financiero y técnico del sistema de automatización y plataforma web desarrollado como solución para clínicas odontológicas. Detalla la valoración técnica de la solución, sus costos de infraestructura cloud 24/7 y la optimización de recursos alcanzada mediante software libre y APIs en capas gratuitas.

---

## 1. Análisis de Arquitectura y Eficiencia de Costos

El sistema implementa una **Arquitectura Híbrida Full-Stack** diseñada para ofrecer máxima disponibilidad con el menor costo operativo posible:

* **Frontend Estático/SSR de Alto Rendimiento (Astro):** Permite servir la plataforma web corporativa multipágina con tiempos de carga instantáneos. Gracias al renderizado en el servidor y generación estática de Astro, el consumo de CPU y memoria en el navegador del cliente es mínimo, optimizando la visualización en dispositivos móviles.
* **Servicios Backend Desacoplados (Node.js & TypeScript + Baileys):** La lógica de automatización de WhatsApp corre en un entorno Node.js optimizado con TypeScript. El uso de **Baileys (WhiskeySockets)** para interactuar directamente con la API de WebSockets de WhatsApp Web evita la necesidad de usar costosos intermediarios de pago por conversación, operando en contenedores ligeros de ~150-250MB de RAM.
* **Integración Cloud Serverless:** La sincronización de citas y pacientes se delega a servicios gestionados de Google Cloud (Calendar API v3 y Sheets API v4), eliminando la necesidad de administrar instancias complejas de bases de datos para un MVP.

---

## 2. Tecnologías y Librerías Utilizadas

El uso estratégico de herramientas *Open Source* y capas libres de desarrollo reduce el costo de licencias a **$0.00 / S/. 0.00**.

| Componente / Librería | Tipo de Licencia | Propósito en el Sistema | Costo de Licencia |
| :--- | :--- | :--- | :--- |
| **Astro** | MIT | Framework web para el portal corporativo multipágina. | S/. 0.00 (Gratuito) |
| **Tailwind CSS** | MIT | Framework CSS utilitario de alto rendimiento. | S/. 0.00 (Gratuito) |
| **Node.js** | MIT / Open Source | Entorno de ejecución para el motor del bot de WhatsApp. | S/. 0.00 (Gratuito) |
| **TypeScript** | Apache 2.0 | Tipado estático y robustez del código en todo el backend. | S/. 0.00 (Gratuito) |
| **Baileys (WhiskeySockets)**| MIT | Conexión WebSocket directa y ligera con la red de WhatsApp. | S/. 0.00 (Gratuito) |
| **Google Gen AI SDK (Gemini)** | Capa Gratuita | Procesamiento de lenguaje natural y extracción de intenciones (Gemini 2.5 Flash / Flash Lite). | S/. 0.00 (Gratuito) |
| **Google Sheets API v4** | Capa Gratuita | Persistencia y almacenamiento directo de datos de pacientes (citas, leads). | S/. 0.00 (Gratuito) |
| **Google Calendar API v3** | Capa Gratuita | Agendamiento centralizado del consultorio en tiempo real. | S/. 0.00 (Gratuito) |
| **Vitest (44 pruebas auto.)** | MIT | Framework de pruebas para verificar la confiabilidad de la lógica. | S/. 0.00 (Gratuito) |

---

## 3. Estimación de Valor Comercial del Desarrollo

| Ítem | Descripción | Valor Estimado (S/.) |
| :--- | :--- | :--- |
| **Plataforma Web Corporativa** | Portal web multipágina, diseño responsive de alto impacto y optimización SEO local. | S/. 1,500.00 |
| **Asistente Virtual IA (Bot)** | Engine en Node.js, procesamiento de lenguaje natural vía Gemini y validaciones estrictas Regex (DNI, fechas). | S/. 1,200.00 |
| **Integración e Infraestructura** | Sincronización en paralelo con Google Workspace (Sheets & Calendar) y validación anti-colisiones. | S/. 600.00 |
| **TOTAL VALORACIÓN** | **Mano de obra técnica, arquitectura y suite de pruebas automatizadas (Vitest)** | **S/. 3,300.00** |

---

## 4. Costos de Infraestructura Cloud Recurrente (24/7)

El mantenimiento recurrente para asegurar que la web y el bot operen sin interrupciones los 365 días del año se reduce al mínimo:

| Servicio Cloud | Proveedor / Plan | Frecuencia de Pago | Costo de Operación |
| :--- | :--- | :--- | :--- |
| **Dominio Institucional** | Registrador (.com o .pe) | Anual (Fijo) | S/. 65.00 |
| **Hosting Frontend** | Vercel / Cloudflare Pages | Mensual | S/. 0.00 (Gratis) |
| **Servidor Backend VPS** | Railway / Render Starter | Mensual | ~S/. 22.00 ($5.50 USD) |
| **Motor de Inteligencia Artificial** | Google AI Studio (Gemini) | Mensual | S/. 0.00 (Capa gratuita) |
| **Base de Datos Centralizada** | Google Cloud Workspace API | Mensual | S/. 0.00 (Capa gratuita) |
