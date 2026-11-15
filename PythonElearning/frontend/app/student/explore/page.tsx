"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Instructor {
  id: number;
  name: string;
  courseCount: number;
  title: string;
  description: string;
}

interface Course {
  id: number;
  title: string;
  description: string | null;
  instructor: string;
  instructorId: number;
  category: string;
  categoryId: number;
  chapterCount: number;
}

interface Category {
  CategoryID: number;
  CategoryName: string;
}

export default function ExplorePage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryId) params.set('categoryId', String(categoryId));
      if (instructorId) params.set('instructorId', String(instructorId));

      try {
        const response = await fetch(`http://localhost:5000/api/student/explore?${params}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải danh sách khóa học.');
        }
        setInstructors(payload.data.instructors);
        setCourses(payload.data.courses);
        setCategories(payload.data.categories);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        console.error('Lỗi tải khóa học khám phá:', requestError);
        setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách khóa học.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search, categoryId, instructorId]);

  const getInitials = (name: string) => name.split(' ').map(part => part[0]).join('').substring(0, 2).toUpperCase();
  const bgColors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500'];

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-6xl mx-auto">
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

        <div className="mb-10">
          <div className="relative mb-4">
            <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên giảng viên, khóa học, danh mục hoặc chủ đề..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryId(null)}
              className={`px-4 py-1.5 text-sm font-bold rounded-lg ${categoryId === null ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              Tất cả
            </button>
            {categories.map(category => (
              <button
                key={category.CategoryID}
                onClick={() => setCategoryId(category.CategoryID)}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg ${categoryId === category.CategoryID ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                {category.CategoryName}
              </button>
            ))}
            {instructorId && (
              <button
                onClick={() => setInstructorId(null)}
                className="px-4 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg"
              >
                Xóa lọc giảng viên ×
              </button>
            )}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Giảng viên</h2>
          <p className="text-sm text-gray-500 mb-5">Chọn giảng viên để xem khóa học đang mở</p>
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">Đang tải giảng viên...</p>
          ) : instructors.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Chưa có giảng viên với khóa học đang mở.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {instructors.map(instructor => (
                <div key={instructor.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {getInitials(instructor.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{instructor.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">{instructor.title}</p>
                    </div>
                  </div>
                  {instructor.description && <p className="text-sm text-gray-600 mb-6 flex-1">{instructor.description}</p>}
                  <div className="flex justify-between items-center text-sm font-bold border-t border-gray-100 pt-4">
                    <span className="text-blue-600">{instructor.courseCount} khóa học</span>
                    <button
                      onClick={() => {
                        setInstructorId(instructor.id);
                        document.getElementById('course-list')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Xem khóa học ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div id="course-list" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Khóa học đang mở</h2>
          <p className="text-sm text-gray-500 mb-5">{courses.length} khóa học phù hợp</p>
          {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-500">Đang tải khóa học...</p>
          ) : courses.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Không tìm thấy khóa học phù hợp.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, index) => (
                <div key={course.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                  <div className={`${bgColors[index % bgColors.length]} h-36 p-5 text-white flex flex-col justify-between relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-110 transition-transform text-6xl">💻</div>
                    <span className="text-[10px] font-bold bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full uppercase tracking-wider relative z-10">{course.category}</span>
                    <h3 className="text-lg font-bold relative z-10 line-clamp-2">{course.title}</h3>
                  </div>
                  <div className="p-4 bg-white flex justify-between items-center flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100 shrink-0">
                        {getInitials(course.instructor)}
                      </div>
                      <span className="text-sm font-bold text-gray-700 truncate">{course.instructor}</span>
                    </div>
                    <Link href={`/student/explore/${course.id}`} className="ml-3 shrink-0 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                      Chi tiết
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
