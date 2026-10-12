"use client";

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        
        if (result.success) {
          setStats(result.data);
        }
      } catch (err) {
        console.error('Lỗi tải Admin Dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminStats();
  }, []);

  if (loading) return <div className="p-8 h-screen flex justify-center items-center">Đang tải dữ liệu hệ thống...</div>;
  if (!stats) return <div className="p-8 text-red-500">Lỗi kết nối đến máy chủ.</div>;

  return (
    <div className="p-8 min-h-screen bg-[#F8FAFC]">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold text-gray-900 mb-1">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Tổng quan hệ thống PyLearn AI</p>
      </div>

      {/* 6 CARDS SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">👥</div>
          <h3 className="text-xl font-bold text-gray-900">{stats.summary.totalUsers.toLocaleString()}</h3>
          <p className="text-xs text-gray-500 font-medium">Total Users</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +12 tháng này</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">🎓</div>
          <h3 className="text-xl font-bold text-blue-600">{stats.summary.students.toLocaleString()}</h3>
          <p className="text-xs text-gray-500 font-medium">Students</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +10 tháng này</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">👩‍🏫</div>
          <h3 className="text-xl font-bold text-purple-600">{stats.summary.instructors}</h3>
          <p className="text-xs text-gray-500 font-medium">Instructors</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +2 tháng này</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">📚</div>
          <h3 className="text-xl font-bold text-orange-600">{stats.summary.courses}</h3>
          <p className="text-xs text-gray-500 font-medium">Courses</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +1 tháng này</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">✨</div>
          <h3 className="text-xl font-bold text-gray-900">{stats.summary.aiRequests > 1000 ? (stats.summary.aiRequests/1000).toFixed(1) + 'k' : stats.summary.aiRequests}</h3>
          <p className="text-xs text-gray-500 font-medium">AI Requests/day</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +18% tháng này</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="text-xl font-bold text-emerald-600">{stats.summary.avgMastery}%</h3>
          <p className="text-xs text-gray-500 font-medium">Avg Mastery</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">↗ +3% tháng này</p>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        
        {/* User Activity Area Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 mb-6">User Activity (7 ngày qua)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.userActivityData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                <Line type="monotone" dataKey="active" stroke="#0EA5E9" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">System Status</h3>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">API Uptime</span>
              <span className="font-bold text-emerald-500">● 99.9%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">AI Service</span>
              <span className="font-bold text-emerald-500">● Healthy</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">DB Response</span>
              <span className="font-bold text-emerald-500">● 42ms</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Error Rate</span>
              <span className="font-bold text-emerald-500">● 0.02%</span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><span className="text-blue-500">★</span> AI Engine</h4>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Learning paths generated</span>
              <span className="font-medium text-gray-900">1,180</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Paths updated today</span>
              <span className="font-medium text-gray-900">48</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* AI Requests Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-lg font-bold text-gray-900">AI Recommendation Requests</h3>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex items-center gap-1">★ Live</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.aiRequestsData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                <Bar dataKey="reqs" fill="#0EA5E9" radius={[2, 2, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity Log</h3>
          <div className="space-y-5">
            {stats.activityLogs.map((log: any, index: number) => (
              <div key={index} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <div>
                  <p className="text-sm text-gray-700">{log.message}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{new Date(log.time).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}