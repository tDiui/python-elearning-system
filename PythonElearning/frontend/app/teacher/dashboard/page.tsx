"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU TỪ BACKEND
type Student = {
  id: number;
  name: string;
  avatar: string;
  progress: number;
  avgScore: number;
  weakTopics: string[];
  lastActive: string;
  status: string;
  color: string;
};

type DashboardData = {
  courseName: string;
  totalStudentsClass: number;
  stats: {
    totalStudents: number;
    activeStudents: number;
    courseCompletion: number;
    avgScore: number;
  };
  pendingApprovals: number;
  gradeDistribution: { range: string; count: number; height: string }[];
  hardTopics: { name: string; percent: number; color: string; text: string }[];
  students: Student[];
};

export default function TeacherDashboard() {
  const router = useRouter();
  
  // 2. KHỞI TẠO STATE
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Tất cả');

  // 3. GỌI API LẤY DỮ LIỆU
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/teacher/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        
        if (result.success && result.data) {
          setDashboardData(result.data);
        }
      } catch (error) {
        console.error('Lỗi tải Teacher Dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [router]);

  // 4. XỬ LÝ GIAO DIỆN KHI ĐANG TẢI HOẶC LỖI
  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-gray-500 font-medium flex items-center gap-2">
          <span className="animate-spin text-2xl">↻</span> Đang tải dữ liệu lớp học...
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] bg-white rounded-3xl border border-gray-100 shadow-sm text-center p-8">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">📊</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Chưa có dữ liệu lớp học</h2>
        <p className="text-gray-500 mb-8 max-w-md">Bạn chưa được phân công giảng dạy khóa học nào hoặc khóa học chưa có sinh viên đăng ký.</p>
      </div>
    );
  }

  // 5. HIỂN THỊ DỮ LIỆU ĐỘNG
  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-6 pb-12">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Instructor Dashboard</h1>
          <p className="text-sm text-gray-500">{dashboardData.courseName} — {dashboardData.totalStudentsClass} sinh viên</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors relative">
          Quản lý đăng ký
          {dashboardData.pendingApprovals > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white">
              {dashboardData.pendingApprovals}
            </span>
          )}
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-2xl mb-2">👥</div>
          <p className="text-2xl font-bold text-blue-700">{dashboardData.stats.totalStudents}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">Total Students</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-2xl font-bold text-emerald-600">{dashboardData.stats.activeStudents}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">Active (7 ngày)</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-2xl mb-2">📈</div>
          <p className="text-2xl font-bold text-indigo-600">{dashboardData.stats.courseCompletion}%</p>
          <p className="text-xs font-bold text-gray-500 mt-1">Course Completion</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-2xl mb-2">🎯</div>
          <p className="text-2xl font-bold text-orange-600">{dashboardData.stats.avgScore}%</p>
          <p className="text-xs font-bold text-gray-500 mt-1">Avg Score</p>
        </div>
      </div>

      {/* ALERT BANNER */}
      {dashboardData.pendingApprovals > 0 && (
        <div className="bg-[#fff9e6] border border-[#ffeca8] rounded-xl p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-[#ffe58f] w-10 h-10 rounded-lg flex items-center justify-center text-xl">⏳</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{dashboardData.pendingApprovals} đơn đăng ký đang chờ duyệt</p>
              <p className="text-xs text-amber-700 font-medium mt-0.5">★ AI đã phân tích mức độ phù hợp của từng sinh viên</p>
            </div>
          </div>
          <button className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1">
            Xem đơn ›
          </button>
        </div>
      )}

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Phân bổ điểm */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="font-bold text-gray-900 mb-6 text-sm">Phân bổ điểm</h3>
          <div className="flex-1 flex items-end justify-between px-2 gap-2 h-40">
            {dashboardData.gradeDistribution.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full bg-blue-600 rounded-t-sm hover:bg-blue-700 transition-all cursor-pointer relative group" style={{ height: item.height }}>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded font-medium transition-opacity">
                    {item.count} SV
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">{item.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tiến độ khóa học */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
          <h3 className="font-bold text-gray-900 mb-6 text-sm w-full text-left">Tiến độ khóa học</h3>
          <div className="relative w-40 h-40 mb-6">
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f3f4f6" strokeWidth="15" />
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563eb" strokeWidth="15" strokeDasharray="180 251" />
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="15" strokeDasharray="60 251" strokeDashoffset="-180" />
            </svg>
            <div className="absolute inset-0 bg-white m-5 rounded-full shadow-inner"></div>
          </div>
          <div className="flex gap-4 text-[10px] text-gray-500 font-medium">
             <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-200 rounded-sm"></span> Chưa bắt đầu</span>
             <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Hoàn thành</span>
             <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></span> Đang học</span>
          </div>
        </div>

        {/* Topics sinh viên khó */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-5 text-sm flex items-center justify-between">
            Topics sinh viên khó <span className="text-amber-500 text-base">ⓘ</span>
          </h3>
          <div className="flex flex-col gap-4">
            {dashboardData.hardTopics.map((topic, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center text-xs font-medium mb-1.5">
                  <span className="text-gray-700">{topic.name}</span>
                  <span className={`font-bold ${topic.text}`}>{topic.percent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`${topic.color} h-1.5 rounded-full`} style={{ width: `${topic.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 border-t border-gray-50 pt-3">% sinh viên đạt mastery {"<"}60%</p>
        </div>

      </div>

      {/* STUDENT LIST TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-gray-900">Danh sách sinh viên</h3>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="absolute left-3 top-2 text-gray-400 text-sm">🔍</span>
              <input type="text" placeholder="Tìm tên, chủ đề yếu..." className="w-full bg-gray-50 border border-gray-100 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            
            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
              {['Tất cả', 'Đang học', 'Không hoạt động'].map(filter => (
                <button 
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeFilter === filter ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
            
            <button className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100">
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-50">
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Sinh viên</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Tiến độ</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Score</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Chủ đề yếu</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Hoạt động cuối</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboardData.students
                // Xử lý Lọc dữ liệu theo Tab (Tất cả / Đang học / Không hoạt động)
                .filter(student => activeFilter === 'Tất cả' || student.status === activeFilter)
                .map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${student.color} text-white font-bold rounded-full flex items-center justify-center text-xs shrink-0`}>
                        {student.avatar}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">{student.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${student.progress}%` }}></div>
                      </div>
                      <span className="text-xs font-medium text-gray-500">{student.progress}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`font-bold text-sm ${student.avgScore >= 80 ? 'text-emerald-600' : student.avgScore >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                      {student.avgScore}%
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-2">
                      {student.weakTopics.length > 0 ? (
                        student.weakTopics.map((topic, i) => (
                          <span key={i} className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded">
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium">Không có</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs text-gray-500 font-medium">
                    {student.lastActive}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'Hoạt động' ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                      <span className={`text-xs font-semibold ${student.status === 'Hoạt động' ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {student.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors">
                      Xem chi tiết ›
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}