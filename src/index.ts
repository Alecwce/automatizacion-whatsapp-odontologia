import { env } from './config/env.js';
import { startWhatsAppBot } from './services/whatsapp.js';
import { startReminderScheduler } from './services/scheduler.js';

console.log('Iniciando sistema de Automatización WhatsApp Odontología...');
console.log('Configuración cargada correctamente. ID de Spreadsheet:', env.spreadsheetId);

let socketInstance: any = null;

async function bootstrap() {
  try {
    socketInstance = await startWhatsAppBot();
    console.log('El bot de WhatsApp está en marcha y escuchando eventos...');
    
    // Iniciar el planificador de recordatorios automáticos
    startReminderScheduler(socketInstance);
  } catch (error) {
    console.error('Fallo crítico al iniciar el bot de WhatsApp:', error);
    process.exit(1);
  }
}

// Control de excepciones globales para evitar caídas imprevistas
process.on('uncaughtException', (error) => {
  console.error('[CRÍTICO] Excepción no capturada (uncaughtException):', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRÍTICO] Promesa no controlada (unhandledRejection):', reason);
});

// Manejo de apagado limpio (Graceful Shutdown)
function gracefulShutdown(signal: string) {
  console.log(`\nRecibida señal ${signal}. Iniciando apagado limpio...`);
  if (socketInstance) {
    try {
      console.log('Cerrando conexión de WhatsApp...');
      socketInstance.end();
    } catch (err) {
      console.error('Error al intentar cerrar el socket de WhatsApp:', err);
    }
  }
  console.log('Sistema detenido correctamente. ¡Hasta luego!');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

bootstrap();
