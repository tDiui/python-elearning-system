"use client";

import { useState, useEffect } from 'react';

// Cấu trúc Type
interface Instructor { id: number; name: string; courseCount: number; title: string; description: string; }
interface Course { id: number; title: string; description: string; instructor: string; category: string; }

export default function ExplorePage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Lấy dữ liệu thật từ Backend
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/student/explore', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInstructors(data.data.instructors);
        setCourses(data.data.courses);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý Đăng ký khóa học
  const handleEnroll = async (courseId: number, courseTitle: string) => {
    if (!window.confirm(`Bạn muốn gửi yêu cầu đăng ký khóa học "${courseTitle}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/student/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId })
      });
      const data = await res.json();
      
      if (data.success) {
        alert("🎉 Đăng ký thành công! Đang chờ giảng viên xét duyệt.");
      } else {
        alert(`⚠️ ${data.message}`);
      }
    } catch (error) {
      alert("Có lỗi xảy ra, vui lòng thử lại sau.");
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 font-medium">Đang tải dữ liệu...</div>;

  // Lấy 2 chữ cái đầu làm Avatar
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  // Mảng màu background ngẫu nhiên cho Card Khóa học
  const bgColors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500'];

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-xs font-bold text-blue-600 tracking-wider mb-2 uppercase">Khám phá • PyLearn AI</p>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Tìm giảng viên, chọn khóa học phù hợp</h1>
            <p className="text-sm text-gray-500">Khám phá chương trình Python và gửi đơn đăng ký trực tiếp đến giảng viên.</p>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 shadow-sm flex items-center gap-2">
            <span>📚 {courses.length} khóa học</span>
            <span className="text-gray-300">/</span>
            <span>{instructors.length} giảng viên</span>
          </div>
        </div>

        {/* Thanh tìm kiếm & Tabs */}
        <div className="mb-10">
          <div className="relative mb-4">
            <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
            <input type="text" placeholder="Tìm tên giảng viên, khóa học hoặc chủ đề Python..." className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg">Tất cả</button>
            <button className="px-4 py-1.5 bg-white text-gray-600 border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50">Python cơ bản</button>
            <button className="px-4 py-1.5 bg-white text-gray-600 border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50">Data Science</button>
            <button className="px-4 py-1.5 bg-white text-gray-600 border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50">Web Development</button>
          </div>
        </div>

        {/* Khu vực Giảng viên */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Giảng viên</h2>
          <p className="text-sm text-gray-500 mb-5">Chọn giảng viên để xem khóa học đang mở</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instructors.map((inst) => (
              <div key={inst.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {getInitials(inst.name)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{inst.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">{inst.title}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6 flex-1">{inst.description}</p>
                <div className="flex justify-between items-center text-sm font-bold border-t border-gray-100 pt-4">
                  <span className="text-blue-600">{inst.courseCount} khóa học</span>
                  <button className="text-blue-600 hover:text-blue-800">Xem khóa học ›</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Khu vực Khóa học */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Khóa học đang mở</h2>
          <p className="text-sm text-gray-500 mb-5">{courses.length} khóa học phù hợp</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => {
              const bgClass = bgColors[index % bgColors.length];
              return (
                <div key={course.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                  <div className={`${bgClass} h-36 p-5 text-white flex flex-col justify-between relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-110 transition-transform text-6xl">💻</div>
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-[10px] font-bold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider">{course.category}</span>
                    </div>
                    <h3 className="text-lg font-bold relative z-10 line-clamp-2">{course.title}</h3>
                  </div>
                  <div className="p-4 bg-white flex justify-between items-center flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                        {getInitials(course.instructor)}
                      </div>
                      <span className="text-sm font-bold text-gray-700">{course.instructor}</span>
                    </div>
                    <button onClick={() => handleEnroll(course.id, course.title)} className="px-5 py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                      Đăng ký
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}