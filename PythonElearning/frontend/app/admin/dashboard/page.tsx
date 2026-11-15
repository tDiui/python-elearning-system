"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

type DashboardStats = {
  summary: {
    totalUsers: number;
    students: number;
    instructors: number;
    courses: number;
    aiRequests: number;
    aiRequestsToday: number;
    avgMastery: number;
  };
  userActivityData: Array<{ key: string; name: string; actions: number }>;
  aiRequestsData: Array<{ time: string; reqs: number }>;
  activityLogs: Array<{ message: string; time: string }>;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json() as { success: boolean; data: DashboardStats };
        
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
          <Link href="/admin/users" className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Xem danh sách →</Link>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">🎓</div>
          <h3 className="text-xl font-bold text-blue-600">{stats.summary.students.toLocaleString()}</h3>
          <p className="text-xs text-gray-500 font-medium">Students</p>
          <Link href="/admin/users" className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Xem danh sách →</Link>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">👩‍🏫</div>
          <h3 className="text-xl font-bold text-purple-600">{stats.summary.instructors}</h3>
          <p className="text-xs text-gray-500 font-medium">Instructors</p>
          <Link href="/admin/users" className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Xem danh sách →</Link>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">📚</div>
          <h3 className="text-xl font-bold text-orange-600">{stats.summary.courses}</h3>
          <p className="text-xs text-gray-500 font-medium">Courses</p>
          <Link href="/admin/courses" className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Xem danh sách →</Link>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">✨</div>
          <h3 className="text-xl font-bold text-gray-900">{stats.summary.aiRequests.toLocaleString()}</h3>
          <p className="text-xs text-gray-500 font-medium">Lượt tạo AI tổng cộng</p>
          <Link href="/admin/analytics" className="mt-1 text-[10px] font-bold text-blue-600 hover:underline">Xem Analytics →</Link>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="text-xl font-bold text-emerald-600">{stats.summary.avgMastery}%</h3>
          <p className="text-xs text-gray-500 font-medium">Avg Mastery</p>
        </div>
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        
        {/* User Activity Area Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-900">Hoạt động học tập (7 ngày qua)</h3>
            <Link href="/admin/analytics" className="text-xs font-semibold text-blue-600 hover:underline">Chi tiết →</Link>
          </div>
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
                <Area type="monotone" dataKey="actions" name="Hoạt động học" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Nguồn dữ liệu dashboard</h3>
          <p className="text-sm leading-6 text-gray-600">
            Biểu đồ bên cạnh phản ánh hoạt động học tập được lưu trong hệ thống, không phải lượt xem trang.
          </p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Chưa ghi nhận lượt xem trang và hiệu suất API. Phần ghi nhận chờ thống nhất thời hạn lưu dữ liệu.
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">Lượt tạo lộ trình AI hôm nay</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stats.summary.aiRequestsToday.toLocaleString()}</p>
            <Link href="/admin/analytics" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">Mở thống kê chi tiết →</Link>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* AI Requests Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-lg font-bold text-gray-900">Yêu cầu AI hôm nay</h3>
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
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-900">Hoạt động học gần đây</h3>
            <Link href="/admin/analytics" className="text-xs font-semibold text-blue-600 hover:underline">Chi tiết →</Link>
          </div>
          <div className="space-y-5">
            {stats.activityLogs.map((log, index) => (
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