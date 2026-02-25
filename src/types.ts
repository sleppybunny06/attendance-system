export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  department: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  status: 'present' | 'late' | 'half-day' | 'absent' | 'absent_pending_reason';
  total_hours: number | null;
  name?: string;
  department?: string;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment: string | null;
  created_at: string;
  name?: string;
  department?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  read_status: number;
  created_at: string;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  trends: { date: string; count: number }[];
}
