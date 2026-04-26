
export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'Major' | 'Huge';
export type IncidentStatus = 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved' | 'Mitigated';

export interface EscalationLevel {
  level: number;
  role: string;
  name: string;
  status: 'Informed' | 'Escalated' | 'Pending';
  time: string;
}

export interface Incident {
  id: string;
  title: string;
  priority: Priority;
  status: IncidentStatus;
  startTime: string;
  description: string;
  commander: string;
  escalations: EscalationLevel[];
  affectedServices: string[];
  impactedCustomers?: string[];
  requestingPOC?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'Available' | 'On-Call' | 'Busy';
  contact: string;
}
