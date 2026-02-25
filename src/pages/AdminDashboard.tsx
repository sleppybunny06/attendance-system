import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Loader2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { DashboardStats, AttendanceRecord, LeaveRequest } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [statsRes, attendanceRes, leavesRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/attendance/today', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/leaves/pending', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (attendanceRes.ok) setTodayAttendance(await attendanceRes.json());
      if (leavesRes.ok) setPendingLeaves(await leavesRes.json());
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        return;
      }
      console.error('Failed to fetch admin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleLeaveAction = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/admin/leaves/${id}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status, comment: 'Processed by admin' }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to process leave', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
        <p className="text-slate-500">Manage your company's attendance and workforce.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees || 0}
          icon={Users}
        />
        <StatCard
          title="Present Today"
          value={stats?.presentToday || 0}
          icon={CheckCircle2}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="On Leave"
          value={stats?.onLeaveToday || 0}
          icon={Calendar}
        />
        <StatCard
          title="Attendance Rate"
          value={stats ? `${((stats.presentToday / stats.totalEmployees) * 100).toFixed(1)}%` : '0%'}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Attendance Trends (Last 7 Days)</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats?.trends.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#4f46e5" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Today's Attendance</h2>
              <button className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Employee</th>
                    <th className="px-6 py-4 font-semibold">Department</th>
                    <th className="px-6 py-4 font-semibold">Punch In</th>
                    <th className="px-6 py-4 font-semibold">Punch Out</th>
                    <th className="px-6 py-4 font-semibold">Hours</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todayAttendance.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                            {record.name?.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{record.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{record.department}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {record.punch_in ? format(new Date(record.punch_in), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {record.punch_out ? format(new Date(record.punch_out), 'hh:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {record.total_hours ? `${record.total_hours}h` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                          record.status === 'present' ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" :
                          record.status === 'late' ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" :
                          "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                        )}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {todayAttendance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                        No one has punched in yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Pending Leaves</h2>
            <div className="space-y-4">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900">{leave.name}</span>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">{leave.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{leave.reason}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleLeaveAction(leave.id, 'rejected')}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleLeaveAction(leave.id, 'approved')}
                        className="p-1.5 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No pending leave requests.</p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl text-white">
            <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm flex items-center justify-between">
                Add New Employee <Users className="w-4 h-4 opacity-50" />
              </button>
              <button className="w-full text-left px-4 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm flex items-center justify-between">
                Generate Report <TrendingUp className="w-4 h-4 opacity-50" />
              </button>
              <button className="w-full text-left px-4 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm flex items-center justify-between">
                System Settings <Clock className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
