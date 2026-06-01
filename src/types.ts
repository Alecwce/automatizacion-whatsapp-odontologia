export type SessionState = 'IDLE' | 'AWAITING_NAME' | 'AWAITING_DNI' | 'AWAITING_DATE';

export interface UserSession {
  state: SessionState;
  patientName?: string;
  patientDni?: string;
  patientDate?: Date;
  attempts: number;
  lastInteraction: Date;
}

export interface PatientData {
  timestamp: string;
  phone: string;
  name: string;
  dni: string;
  appointmentDate?: string;
}

export interface ParserResult {
  extractedValue: string | null;
  isValid: boolean;
}
