# Informe Económico y Presupuesto del Sistema: Consultorio Sánchez

Este documento presenta el análisis financiero y técnico del sistema de automatización y plataforma web corporativa desarrollado para el **Consultorio Sánchez**, ubicado en la región Junín (Jr. Loreto 217, Huancayo, cerca de la Plaza Constitución). El reporte detalla la valoración comercial de la solución, sus costos de mantenimiento 24/7 y las condiciones especiales aplicadas.

---

## 1. Introducción y Análisis de Valor Geolocalizado

El sistema implementa una **Arquitectura Híbrida Full-Stack** diseñada para ofrecer máxima disponibilidad con el menor costo operativo posible:

*   **Frontend Estático/SSR de Alto Rendimiento (Astro 6):** Permite servir la plataforma web corporativa multipágina con tiempos de carga instantáneos. Gracias al renderizado en el servidor y generación estática de Astro, el consumo de CPU y memoria en el navegador del cliente es mínimo, optimizando la visualización en dispositivos móviles de pacientes en Huancayo, El Tambo y Chupaca.
*   **Servicios Backend Desacoplados (Node.js & TypeScript + Baileys):** La lógica de automatización de WhatsApp corre en un entorno Node.js optimizado con TypeScript. El uso de **Baileys (WhiskeySockets)** para interactuar directamente con la API de WebSockets de WhatsApp Web evita la necesidad de usar costosos intermediarios de pago (como la API oficial de Meta o servicios cloud pesados basados en Puppeteer/headless browsers). Esto disminuye drásticamente el consumo de RAM (operando en contenedores pequeños de ~150-250MB) y permite un despliegue cloud sumamente económico.
*   **Localización Regional:** El ecosistema está diseñado bajo el contexto geográfico de la **Región Junín (Huancayo, El Tambo, Chupaca)**, centralizando su atención física en la sede del **Jr. Loreto 217**, a pocos metros de la Plaza Constitución en Huancayo, facilitando la programación de citas presenciales mediante el asistente virtual automatizado.

---

## 2. Cuadro Detallado de Tecnologías y Librerías (Costo de Licencias)

El uso estratégico de herramientas *Open Source* y capas libres de desarrollo reduce el costo de licencias y propiedad intelectual a **S/. 0.00**.

| Componente / Librería | Tipo de Licencia | Propósito en el Sistema | Costo de Licencia |
| :--- | :--- | :--- | :--- |
| **Astro v6** | MIT | Framework web para el portal corporativo multipágina. | S/. 0.00 (Gratuito) |
| **Tailwind CSS v4** | MIT | Framework CSS de alto rendimiento para el diseño visual interactivo. | S/. 0.00 (Gratuito) |
| **Lucide-Astro** | ISC | Set de íconos vectoriales modernos y ligeros para la interfaz web. | S/. 0.00 (Gratuito) |
| **Node.js** | MIT / Open Source | Entorno de ejecución para el motor del bot de WhatsApp. | S/. 0.00 (Gratuito) |
| **TypeScript v5** | Apache 2.0 | Tipado estático y robustez del código en todo el backend. | S/. 0.00 (Gratuito) |
| **Baileys (WhiskeySockets) v6**| MIT | Conexión WebSocket directa y ligera con la red de WhatsApp. | S/. 0.00 (Gratuito) |
| **Google Gen AI SDK (Gemini)** | Capa Gratuita | Cerebro inteligente de procesamiento de lenguaje natural (Gemini 3.1 Flash Lite API). | S/. 0.00 (Gratuito) |
| **Google Sheets API v4** | Capa Gratuita | Persistencia y almacenamiento directo de datos de pacientes (citas, leads). | S/. 0.00 (Gratuito) |
| **Google Calendar API v3** | Capa Gratuita | Agendamiento centralizado del consultorio en tiempo real. | S/. 0.00 (Gratuito) |
| **Vitest (44 pruebas auto.)** | MIT | Framework de pruebas para verificar la confiabilidad de la lógica. | S/. 0.00 (Gratuito) |

---

## 3. Cuadro de Desarrollo y Mano de Obra (Precios de Mercado en Soles - S/.)

Esta sección cuantifica el valor comercial en el mercado peruano del diseño, programación y pruebas del software a medida.

| Ítem | Descripción | Valor Comercial (S/.) |
| :--- | :--- | :--- |
| **Plataforma Web Corporativa** | Portal web multipágina, diseño responsive de alto impacto, HeroCarousel y optimización SEO local para Junín. | S/. 1,500.00 |
| **Asistente Virtual IA (Bot)** | Engine en Node.js, procesamiento de lenguaje natural vía Gemini 3.1 Flash Lite y filtros estrictos Regex de seguridad de 8 dígitos (DNI). | S/. 1,200.00 |
| **Integración e Infraestructura** | Sincronización en paralelo con Google Workspace (Sheets & Calendar) y protección con escudo de colisiones de 1 hora. | S/. 600.00 |
| **TOTAL VALOR COMERCIAL** | **Mano de obra, ingeniería financiera y pruebas automatizadas (Vitest)** | **S/. 3,300.00** |

---

## 4. Cuadro de Infraestructura Cloud (Mantenimiento Real 24/7)

El mantenimiento recurrente para asegurar que la web y el bot operen sin interrupciones los 365 días del año se reduce al mínimo gracias a la arquitectura eficiente.

| Servicio Cloud | Proveedor / Plan | Frecuencia de Pago | Costo de Operación |
| :--- | :--- | :--- | :--- |
| **Dominio Institucional** | Registrador (.com o .pe) | Anual (Fijo) | S/. 65.00 |
| **Hosting Frontend** | Vercel (Hobby Plan) | Mensual | S/. 0.00 (Gratis) |
| **Servidor Backend VPS** | Railway / Render Starter | Mensual | S/. 22.00 ($5.50 USD approx.) |
| **Motor de Inteligencia Artificial** | Google AI Studio (Gemini Lite) | Mensual | S/. 0.00 (Capa gratuita - 500 msgs/día) |
| **Base de Datos Centralizada** | Google Cloud Workspace API | Mensual | S/. 0.00 (Capa gratuita) |

### Conclusión Económica de Operación
El diseño arquitectónico implementado representa un beneficio de ahorro excepcional para la Dra. Luisa Sánchez. Ella adquiere un sistema corporativo personalizado con un valor real de mercado de **S/. 3,300.00**, asumiendo un costo operativo recurrente mínimo de solo **S/. 22.00 mensuales** por el servidor VPS del backend, y un pago fijo anual de **S/. 65.00** para mantener activo su dominio institucional en internet.

---

## 5. Resumen del Acuerdo Universitario (Precio Preferencial Amix)

Como apoyo al equipo académico y en calidad de tarifa promocional preferencial de cooperación ("Amix"), se consolida el siguiente plan de pago exclusivo:

| Concepto | Detalle de Cobro | Subtotal (S/.) |
| :--- | :--- | :--- |
| **Bot Base de WhatsApp** | Deuda pendiente acordada del bot backend. | S/. 240.00 |
| **Adición de Portal Web y Parches**| Integración de portal web corporativo multipágina y parches de seguridad. | S/. 150.00 |
| **TOTAL PAQUETE PREFERENCIAL**| **A abonar por el equipo (3 integrantes)** | **S/. 390.00** |

### Distribución por Integrante
El costo total preferencial se divide equitativamente entre los 3 miembros del equipo de trabajo:
$$\text{Costo por Persona} = \frac{\text{S/. 390.00}}{3} = \mathbf{\text{S/. 130.00}}$$

> [!IMPORTANT]
> Este precio de **S/. 390.00** representa únicamente el **11.8%** de la valoración real de mercado del proyecto (**S/. 3,300.00**), significando un subsidio de apoyo universitario equivalente al **88.2%** del esfuerzo de desarrollo e ingeniería.
