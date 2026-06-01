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
