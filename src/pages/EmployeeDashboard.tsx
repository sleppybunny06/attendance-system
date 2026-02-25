import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRightLeft,
  Loader2,
  Timer
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { AttendanceRecord, LeaveRequest } from '../types';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function EmployeeDashboard() {
  const { user, token } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [todayRes, historyRes, leavesRes] = await Promise.all([
        fetch('/api/attendance/today', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance/history', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/leaves/my', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (todayRes.ok) setTodayRecord(await todayRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      if (leavesRes.ok) setLeaves(await leavesRes.json());
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        return;
      }
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handlePunchIn = async () => {
    setIsPunching(true);
    try {
      const res = await fetch('/api/attendance/punch-in', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Punch in failed', err);
    } finally {
      setIsPunching(false);
    }
  };

  const handlePunchOut = async () => {
    setIsPunching(true);
    try {
      const res = await fetch('/api/attendance/punch-out', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Punch out failed', err);
    } finally {
      setIsPunching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const totalHoursThisMonth = history.reduce((acc, curr) => acc + (curr.total_hours || 0), 0);
  const attendanceRate = (history.filter(h => h.status === 'present' || h.status === 'late').length / 30 * 100).toFixed(1);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome, {user?.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">Here's what's happening with your attendance today.</p>
        </div>
        <div className="flex items-center gap-3">
          {!todayRecord?.punch_in ? (
            <button
              onClick={handlePunchIn}
              disabled={isPunching}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              {isPunching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
              Punch In
            </button>
          ) : !todayRecord?.punch_out ? (
            <button
              onClick={handlePunchOut}
              disabled={isPunching}
              className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-rose-200 dark:shadow-none"
            >
              {isPunching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
              Punch Out
            </button>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-6 py-2.5 rounded-xl font-semibold border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Work Finished
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Status"
          value={todayRecord?.status ? todayRecord.status.toUpperCase() : 'NOT PUNCHED'}
          icon={Timer}
          description={
            todayRecord?.punch_in 
              ? `In: ${format(new Date(todayRecord.punch_in), 'hh:mm a')}${todayRecord.punch_out ? ` • Out: ${format(new Date(todayRecord.punch_out), 'hh:mm a')}` : ''}` 
              : 'Waiting for punch in'
          }
        />
        <StatCard
          title="Working Hours"
          value={todayRecord?.total_hours ? `${todayRecord.total_hours}h` : '0h'}
          icon={Clock}
          description="Total hours for today"
        />
        <StatCard
          title="Monthly Hours"
          value={`${totalHoursThisMonth.toFixed(1)}h`}
          icon={Calendar}
          description="Total hours this month"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          icon={CheckCircle2}
          description="Based on last 30 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attendance History</h2>
            <button className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Punch In</th>
                  <th className="px-6 py-4 font-semibold">Punch Out</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100 font-medium">
                      {format(new Date(record.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.punch_in ? format(new Date(record.punch_in), 'hh:mm a') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.punch_out ? format(new Date(record.punch_out), 'hh:mm a') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full",
                        record.status === 'present' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" :
                        record.status === 'late' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                        "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                      )}>
                        {record.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.total_hours ? `${record.total_hours}h` : '-'}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Leave Requests</h2>
            <div className="space-y-4">
              {leaves.slice(0, 3).map((leave) => (
                <div key={leave.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{leave.type}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      leave.status === 'pending' ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" :
                      leave.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" :
                      "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                    )}>
                      {leave.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium line-clamp-1">{leave.reason}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                  </p>
                </div>
              ))}
              {leaves.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No leave requests yet.</p>
              )}
              <Link to="/leaves" className="block w-full text-center py-2 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">
                Apply for Leave
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            <h3 className="font-bold text-lg mb-2">Need Help?</h3>
            <p className="text-indigo-100 text-sm mb-4">Contact HR if you have any issues with your attendance or leave requests.</p>
            <button className="bg-white/20 hover:bg-white/30 transition-colors w-full py-2 rounded-xl text-sm font-semibold">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
