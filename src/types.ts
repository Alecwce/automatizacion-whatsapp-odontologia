export type SessionState = 'IDLE' | 'AWAITING_NAME' | 'AWAITING_DNI' | 'AWAITING_DATE' | 'AWAITING_REASON';

export interface UserSession {
  state: SessionState;
  patientName?: string;
  patientDni?: string;
  patientDate?: Date;
  patientReason?: string;
  attempts: number;
  lastInteraction: Date;
}

export interface PatientData {
  timestamp: string;
  phone: string;
  name: string;
  dni: string;
  appointmentDate?: string;
  patientReason?: string;
}

export interface ParserResult {
  extractedValue: string | null;
  isValid: boolean;
}
