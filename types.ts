
export interface Section {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  parentContact?: string;
  qrValue: string;
  sectionId: string;
}

export interface AttendanceRecord {
  studentId: string;
  timestamp: number;
  status: 'present' | 'absent' | 'late';
}

export type AppView = 'generator' | 'scanner' | 'records' | 'sections';

export interface AttendanceSession {
  id: string;
  date: string;
  records: AttendanceRecord[];
  sectionId: string;
}
