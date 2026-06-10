export type SessionState = 'IDLE' | 'AWAITING_NAME' | 'AWAITING_DNI' | 'AWAITING_PHONE' | 'AWAITING_DATE' | 'AWAITING_REASON';

export interface UserSession {
  state: SessionState;
  patientName?: string;
  patientDni?: string;
  userPhone?: string; // Teléfono de contacto ingresado por el usuario (9 dígitos)
  patientDate?: Date;
  patientReason?: string;
  phone?: string;
  attempts: number;
  lastInteraction: Date;
}

export interface PatientData {
  timestamp: string;
  phone: string; // El número ingresado por el usuario
  name: string;
  dni: string;
  appointmentDate?: string;
  patientReason?: string;
  whatsappId?: string; // ID técnico de WhatsApp (remitente original)
}

export interface ParserResult {
  extractedValue: string | null;
  isValid: boolean;
}
