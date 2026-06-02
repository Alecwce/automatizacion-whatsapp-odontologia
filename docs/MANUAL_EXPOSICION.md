# 🛡️ MANUAL TÉCNICO DE DEFENSA: ASISTENTE HÍBRIDO ODONTOLÓGICO

Este documento contiene la justificación técnica, explicación de arquitectura y guía de respuestas para la defensa del proyecto ante un jurado académico.

---

## 1. Justificación del Sistema y Conexiones

### ¿Por qué usamos Baileys y no la API Oficial de WhatsApp?
Evaluamos la API oficial de Meta para grandes empresas, pero la descartamos para este prototipo (MVP) por los **costos**. Meta cobra en dólares por cada conversación iniciada. Para un consultorio que recibe decenas de mensajes diarios preguntando solo "¿están abiertos?", sería financieramente insostenible. 
Usamos la librería **Baileys**, que se conecta haciendo un puente directo (ingeniería inversa vía WebSockets) con WhatsApp Web. Esto nos permite automatizar el número normal de la clínica **gratis**, validando que el producto funciona en el mercado real antes de invertir en infraestructura costosa.

### El Cerebro Administrativo: ¿Cómo nos conectamos a Google?
Para conectar nuestro código con Google Sheets y Google Calendar sin intervención humana, usamos la infraestructura oficial de **Google Cloud Platform (GCP)**:
1. **La Puerta Trasera (Las APIs):** Activamos las APIs de Sheets and Calendar, que son puentes de comunicación oficiales entre sistemas.
2. **El Gafete VIP (Service Account):** No usamos el correo y contraseña del doctor por seguridad. Creamos una "Cuenta de Servicio", que actúa como un empleado virtual del bot.
3. **Las Credenciales:** Google nos entregó una llave electrónica encriptada (`.json`). Le dimos permisos de "Editor" a este empleado virtual únicamente en la hoja de Excel y el Calendario de la clínica, manteniendo la privacidad total del resto de la cuenta del doctor.

### Eficiencia Tecnológica
El asistente está construido utilizando una arquitectura liviana y optimizada en memoria. Al utilizar tecnologías nativas de Node.js, TypeScript y la versión ligera de Gemini (3.1 Flash Lite), el bot consume menos de 150 MB de memoria RAM en tiempo de ejecución. Esto hace que el sistema sea extremadamente rentable, permitiendo que corra de manera fluida y económica incluso en servidores de gama baja o computadoras de bajo rendimiento sin impactar el hardware de la clínica.

---

## 2. Anatomía del Código (Cómo funciona cada archivo)

### ⚙️ El Núcleo y Seguridad
*   **`index.ts` (La Puerta Principal):** El motor de arranque. Aquí encendemos el servidor, generamos el código QR para vincular el celular y ponemos al bot a escuchar mensajes.
*   **`config/env.ts` (El Guardián):** Verifica que tengamos todas las contraseñas de Google y tokens de IA antes de arrancar. Si falta una llave, el sistema se bloquea por seguridad.
*   **`types.ts` (El Plano Estricto):** Usamos TypeScript para obligar al código a seguir reglas. Define que un paciente *debe* tener Nombre, DNI, Fecha y Motivo. Si falta algo, el sistema lo rechaza.

### 🧠 Los 4 Pilares (Carpeta `services/`)
1.  **`ai.ts` (El Traductor Empático):** Se conecta a Gemini 3.1 Flash Lite. Tiene instrucciones estrictas para actuar como recepcionista. Limpia la jerga del paciente y traduce fechas relativas ("pasado mañana") a fechas exactas.
2.  **`whatsapp.ts` (El Controlador FSM):** El núcleo del negocio. Obliga al paciente a seguir un carril: *Nombre -> DNI -> Fecha -> Motivo*. Hasta que no se da un dato válido, no avanza, evitando bases de datos sucias.
3.  **`calendar.ts` (El Validador):** Antes de agendar, revisa el calendario de Google en milisegundos para evitar choques de horario.
4.  **`sheets.ts` (El Notario):** Toma los datos limpios y los inyecta en una fila de Google Sheets.

*Nota:* También contamos con `utils/parser.ts`, un motor que limpia textos (ej. extrae solo los números si el paciente escribe su DNI con letras).

### 🛠️ Infraestructura Oculta
*   **Carpeta `tests/`:** Contiene más de 40 pruebas automatizadas que simulan pacientes intentando romper el bot. El sistema pasa el 100% de las pruebas antes de funcionar.
*   **Carpeta `auth_info_baileys/`:** Guarda la sesión encriptada de WhatsApp para no tener que escanear el QR todos los días.

---

## 3. Explicación del Diagrama de Arquitectura
*(Referencia visual: Organigrama del Sistema)*

*   **`index.ts`:** El punto de entrada superior que inicia todo.
*   **`config/env.ts` y `services/whatsapp.ts`:** Validan la seguridad y establecen la conexión con el celular.
*   **`FSM Conversational Engine`:** La Recepcionista Jefe. Decide qué hacer con el mensaje del paciente.
*   **Las 4 Ramas Inferiores (El Equipo de Trabajo):** El FSM delega el trabajo de limpiar textos (`parser.ts`), entender el lenguaje (`ai.ts`) y guardar la información (`sheets.ts` y `calendar.ts`).

---

## 4. Guía de Respuestas a "Preguntas Trampa"

**TRAMPA 1: "La Inteligencia Artificial inventa cosas. ¿Cómo evitan que agende datos falsos?"**
*Respuesta:* "Por eso usamos una 'Arquitectura Híbrida'. La IA solo actúa como la recepcionista amable que entiende el lenguaje en la sala de espera. Al momento de pedir DNI y fijar fecha, la IA se apaga y el sistema tradicional de reglas estrictas toma el control. Si el DNI no es válido, no avanza. Cero alucinaciones."

**TRAMPA 2: "¿Cómo evitan el Overbooking si dos personas piden la misma hora?"**
*Respuesta:* "Justo un milisegundo antes de confirmar, el código lee Google Calendar. Si dos piden a las 4pm, el que llega primero bloquea el espacio en tiempo real. Al segundo, el código lo rechaza amablemente y le pide otra hora."

**TRAMPA 3: "¿No es lento guardar en Excel y luego en Calendar?"**
*Respuesta:* "No, porque usamos programación concurrente (`Promise.all`). Mandamos ambas órdenes de guardado a los servidores de Google exactamente al mismo tiempo (en paralelo), reduciendo la espera a 2 segundos."

**TRAMPA 4: "¿Qué pasa si un paciente insulta al bot?"**
*Respuesta:* "Le inyectamos un 'System Prompt' restrictivo. Si alguien lo insulta o pregunta cosas fuera de contexto, la IA ignora la ofensa y responde: *'Hola, soy el asistente de la clínica, ¿en qué te puedo ayudar con tus citas?'*."

**TRAMPA 5: "¿Esto funciona si apago la computadora?"**
*Respuesta:* "Para esta fase MVP universitaria, el servidor central es nuestra computadora local. En una fase de producción real, este mismo código se empaqueta y se traslada a un servidor en internet para que funcione 24/7 de forma autónoma."

**TRAMPA 6: "¿Qué ocurre con la privacidad de los datos al usar una IA de Google?"**
*Respuesta:* "La privacidad está totalmente garantizada. Al consumir el servicio de Google Generative AI mediante su API comercial/desarrollador (y no la versión web de consumidor general de Gemini), las políticas de privacidad de Google prohíben explícitamente el uso de nuestros datos y los mensajes del paciente para entrenar o mejorar sus modelos. Los datos de la clínica y de los pacientes permanecen 100% aislados y confidenciales."

---

## 5. Roadmap: Mejoras a Futuro (Fase 2)
Este MVP resuelve el cuello de botella de las reservas. Para escalar el sistema, tenemos proyectadas las siguientes mejoras técnicas:

1.  **Módulo de Cancelación y Reprogramación:** Permitir al paciente escribir "Cancelar mi cita" para que el bot libere el bloque en Calendar automáticamente.
2.  **Recordatorios Cronometrados (Cron Jobs):** Implementar un motor que lea el calendario a las 8:00 AM y envíe un WhatsApp automático a los pacientes recordando su cita del día siguiente.
3.  **Integración de Pasarela de Pagos:** Generar links de pago automáticos (MercadoPago/Niubiz) para cobrar el 50% de la consulta por adelantado antes de confirmar la cita en el calendario.

---

## 6. Protocolo para la Demostración en Vivo
1. Compartir pantalla dividida: WhatsApp Web a un lado, Google Calendar y Sheets al otro.
2. Seguir un guion de prueba controlado: 
   *   Saludo informal.
   *   Intento de agendar en un horario ya ocupado para demostrar el bloqueo.
   *   Reserva exitosa para demostrar la sincronización atómica en pantalla.
