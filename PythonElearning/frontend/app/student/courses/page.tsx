"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// === ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU ĐỘNG ===
type Lesson = {
  id: number;
  title: string;
  duration: string;
  status: 'completed' | 'in-progress' | 'locked';
};

type Chapter = {
  id: number;
  title: string;
  completedLessons: number;
  totalLessons: number;
  status: 'completed' | 'in-progress' | 'locked';
  lessons: Lesson[];
};

type CourseData = {
  id: number;
  title: string;
  category: string;
  description: string;
  instructorName: string;
  instructorAvatar: string;
  totalLessons: number;
  totalExercises: number;
  totalQuizzes: number;
  totalHours: string;
  progressPercent: number;
  completedCount: number;
  inProgressCount: number;
  remainingCount: number;
  nextLesson: { chapterName: string; lessonName: string; duration: string } | null;
  chapters: Chapter[];
};

export default function CoursesPage() {
  const router = useRouter();
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // GỌI API LẤY DỮ LIỆU TỪ BACKEND
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/student/courses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
          setData(result.data); // Nếu DB trống, result.data sẽ là null
        }
      } catch (error) {
        console.error('Lỗi tải dữ liệu khóa học:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [router]);

  // HÀM RENDER ICON THEO TRẠNG THÁI BÀI HỌC
  const renderLessonIcon = (status: string) => {
    if (status === 'completed') {
      return (
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      );
    }
    if (status === 'in-progress') {
      return (
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 pl-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
        </div>
      );
    }
    // locked
    return (
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border border-gray-200">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-gray-500 font-medium flex items-center gap-2">
          <span className="animate-spin text-2xl">↻</span> Đang tải dữ liệu khóa học...
        </div>
      </div>
    );
  }

  // TRẠNG THÁI TRỐNG (EMPTY STATE) KHI DATABASE CHƯA CÓ KHÓA HỌC
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] bg-white rounded-3xl border border-gray-100 shadow-sm text-center p-8">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">📚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Chưa có khóa học nào</h2>
        <p className="text-gray-500 mb-8 max-w-md leading-relaxed">Bạn chưa đăng ký tham gia khóa học Python nào. Hãy khám phá danh mục khóa học của chúng tôi để bắt đầu hành trình lập trình của bạn.</p>
        <Link href="#" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md">
          Khám phá danh sách khóa học
        </Link>
      </div>
    );
  }

  // TRẠNG THÁI CÓ DỮ LIỆU (RENDER ĐỘNG THEO ẢNH THIẾT KẾ)
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
      
      {/* 1. HERO BANNER KHÓA HỌC */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Nửa trên nền xanh */}
        <div className="bg-[#0f609b] p-8 text-white relative">
          <div className="flex justify-between items-start">
            <div className="flex gap-5">
              <div className="w-16 h-16 bg-[#1a2f4c] rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                <span className="text-4xl text-green-400">🐍</span>
              </div>
              <div>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-3 inline-block">
                  {data.category}
                </span>
                <h1 className="text-2xl font-bold">{data.title}</h1>
              </div>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
              ▶ Tiếp tục học
            </button>
          </div>
        </div>

        {/* Nửa dưới nền trắng */}
        <div className="p-8 pb-6">
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {data.description}
          </p>

          <div className="flex flex-wrap gap-8 items-center border-b border-gray-100 pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">{data.instructorAvatar}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{data.instructorName}</p>
                <p className="text-xs text-gray-500">Instructor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📖</span> {data.totalLessons} bài học
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>💻</span> {data.totalExercises} bài tập
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>📝</span> {data.totalQuizzes} quiz
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>⏱</span> ~{data.totalHours} giờ
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-gray-900">Tiến độ hoàn thành</span>
              <span className="text-sm font-bold text-blue-600">{data.progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${data.progressPercent}%` }}></div>
            </div>
            <p className="text-[11px] text-gray-400">{data.completedCount}/{data.totalLessons} bài học hoàn thành</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. CỘT TRÁI: DANH SÁCH CHƯƠNG VÀ BÀI HỌC ĐỘNG */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {data.chapters.map((chapter) => (
            <div key={chapter.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{chapter.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{chapter.completedLessons}/{chapter.totalLessons} bài hoàn thành</p>
                </div>
                {chapter.status === 'completed' && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                    ✓ Hoàn thành
                  </span>
                )}
                {chapter.status === 'in-progress' && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                    Đang học
                  </span>
                )}
              </div>
              
              <div className="flex flex-col">
                {chapter.lessons.map((lesson, idx) => (
                  <div key={lesson.id} className={`flex items-center justify-between p-4 px-6 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${lesson.status === 'in-progress' ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-4">
                      {renderLessonIcon(lesson.status)}
                      <span className={`text-sm font-medium ${lesson.status === 'locked' ? 'text-gray-400' : (lesson.status === 'in-progress' ? 'text-blue-700' : 'text-gray-700')}`}>
                        {lesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {lesson.status === 'in-progress' && (
                        <span className="text-[10px] font-bold text-blue-600">Đang học</span>
                      )}
                      <div className={`text-xs flex items-center gap-1 ${lesson.status === 'locked' ? 'text-gray-300' : 'text-gray-400'}`}>
                        <span>⏱</span> {lesson.duration}
                        <span className="ml-2">›</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 3. CỘT PHẢI: WIDGET THỐNG KÊ VÀ NEXT LESSON */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-6">Tiến độ học</h3>
            <div className="flex justify-center mb-8">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#2563eb" strokeWidth="8" strokeDasharray={`${data.progressPercent * 2.51} 251`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{data.progressPercent}%</span>
                  <span className="text-[10px] text-gray-400 mt-1">hoàn thành</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Đã hoàn thành</span>
                <span className="font-bold text-emerald-600">{data.completedCount} bài</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Đang học</span>
                <span className="font-bold text-blue-600">{data.inProgressCount} bài</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Còn lại</span>
                <span className="font-bold text-gray-900">{data.remainingCount} bài</span>
              </div>
            </div>
          </div>

          {data.nextLesson && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Bài học tiếp theo</h3>
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-50 mb-4">
                <p className="text-xs text-blue-600 font-medium mb-1">{data.nextLesson.chapterName}</p>
                <p className="text-sm font-bold text-gray-900 mb-2">{data.nextLesson.lessonName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span>⏱</span> {data.nextLesson.duration}
                </p>
              </div>
              <button className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                ▶ Học ngay
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}