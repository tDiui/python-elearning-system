"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// === KHAI BÁO CẤU TRÚC DỮ LIỆU ===
interface ExerciseItem {
  id: number;
  title: string;
  difficultyLevel: number;
  timeLimit: number;
}

interface LessonDetail {
  id: number;
  title: string;
  chapter: string;
  duration: number;
  difficulty: string;
  hasVideo: boolean;
  videoUrl: string | null;
  hasArticle: boolean;
  articleContent: string | null;
  objectives: string | null; 
  codeExample: string | null;
  exercises: ExerciseItem[];
}

interface CourseItem {
  id: number;
  title: string;
  duration: string;
  status: string;
}

interface Chapter {
  id: number;
  title: string;
  lessons: CourseItem[];
}

interface CourseData {
  id: number;
  title: string;
  progressPercent: number;
  completedCount: number;
  totalLessons: number;
  chapters: Chapter[];
}

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return router.push('/login');

        const [lessonRes, courseRes] = await Promise.all([
          fetch(`http://localhost:5000/api/student/lesson?id=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:5000/api/student/courses`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const lessonData = await lessonRes.json();
        const courseData = await courseRes.json();

        if (lessonData.success) setLesson(lessonData.data);
        if (courseData.success) setCourse(courseData.data);

      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // HÀM TÌM BÀI HỌC TIẾP THEO
  const getNextLesson = () => {
    if (!course) return null;
    const allLessons = course.chapters.flatMap(c => c.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === parseInt(id));
    if (currentIndex !== -1 && currentIndex < allLessons.length - 1) {
      return allLessons[currentIndex + 1];
    }
    return null;
  };

  const handleNavigate = (lessonId: number, status: string) => {
    if (status === 'locked') {
      alert('🔒 Bài học này đang bị khóa!');
      return;
    }
    router.push(`/student/lesson/${lessonId}`);
  };

  const nextLesson = getNextLesson();

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-medium">Đang tải dữ liệu thực...</div>;
  if (!lesson || !course) return <div className="h-screen flex items-center justify-center">Không tìm thấy dữ liệu khóa học!</div>;

  return (
    <div className="flex h-screen bg-white overflow-hidden text-sm">
      
{/* ==============================================================
          CỘT TRÁI: MENU BÀI HỌC (ĐÃ SỬA LỖI GỘP BÀI)
      ============================================================== */}
      <div className="w-[280px] border-r border-gray-100 flex flex-col bg-gray-50/30 shrink-0">
        <div className="p-5 border-b border-gray-100">
          <Link href="/student/courses" className="text-xs font-semibold text-blue-600 hover:underline mb-2 inline-block">
            ← Trở về Khóa học
          </Link>
          {/* Sửa lại: Hiển thị tên Khóa học ở trên cùng thay vì tên Chương */}
          <h2 className="text-[14px] font-extrabold text-gray-900 line-clamp-2 uppercase">{course.title}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {course.chapters.map((chapter) => (
            <div key={chapter.id}>
              
              {/* ĐÂY LÀ DÒNG BỊ THIẾU: Hiển thị tiêu đề của từng Chapter để phân tách */}
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                {chapter.title}
              </h3>

              <div className="space-y-1">
                {chapter.lessons.map((item) => {
                  const isActive = item.id === parseInt(id);
                  const isCompleted = item.status === 'completed';
                  const isLocked = item.status === 'locked';
                  
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleNavigate(item.id, item.status)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors 
                        ${isActive ? 'bg-blue-50/50 border border-blue-100 text-blue-700 cursor-default' : 
                          isLocked ? 'cursor-not-allowed text-gray-400 opacity-70' : 
                          'hover:bg-gray-100 cursor-pointer text-gray-600'}`}
                    >
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white pl-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
                        </div>
                      ) : isCompleted ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0"></div>
                      )}
                      
                      <span className={isActive ? "font-bold line-clamp-2 text-[13px]" : "font-medium line-clamp-2 text-[13px]"}>
                        {item.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==============================================================
          CỘT GIỮA: NỘI DUNG BÀI HỌC (CHUẨN FIGMA)
      ============================================================== */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-10 pb-24">
          
          {/* Breadcrumb & Tiêu đề */}
          <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-2 font-medium">
            <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => router.push('/student/courses')}>{lesson.chapter}</span>
            <span>›</span>
            <span className="text-blue-600">{lesson.title}</span>
          </div>
          
          <h1 className="text-[28px] font-extrabold text-gray-900 mb-3">{lesson.title}</h1>
          
          <div className="flex items-center gap-4 text-xs font-semibold mb-8">
            <span className="flex items-center gap-1.5 text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {lesson.duration} phút
            </span>
            <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">{lesson.difficulty === 'Beginner' ? 'Cơ bản' : lesson.difficulty === 'Intermediate' ? 'Trung bình' : 'Nâng cao'}</span>
          </div>

          {/* Video (Nếu có) */}
          {lesson.hasVideo && (
            <div className="aspect-video bg-black rounded-xl mb-8 flex items-center justify-center text-gray-500 border border-gray-200 shadow-sm overflow-hidden">
              {lesson.videoUrl ? <iframe src={lesson.videoUrl} className="w-full h-full" allowFullScreen></iframe> : "Video đang được cập nhật..."}
            </div>
          )}

          {/* 1. Mục tiêu bài học (UI Figma Card) */}
          {lesson.objectives && (
            <div className="bg-white border border-blue-100 rounded-xl p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎯</span>
                <h3 className="font-bold text-gray-900 text-[15px]">Mục tiêu bài học</h3>
              </div>
              <div className="flex flex-col gap-3">
                {(() => {
                  try {
                    const parsedObjectives = JSON.parse(lesson.objectives);
                    const list = Array.isArray(parsedObjectives) ? parsedObjectives : lesson.objectives.split('\n');
                    return list.map((obj, idx) => {
                      if (!obj.trim()) return null;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-blue-500 font-bold mt-0.5">→</span>
                          <span className="text-gray-700 text-[14px] leading-relaxed">{obj}</span>
                        </div>
                      );
                    });
                  } catch (e) {
                    return lesson.objectives.split('\n').map((obj, idx) => {
                      if (!obj.trim()) return null;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-blue-500 font-bold mt-0.5">→</span>
                          <span className="text-gray-700 text-[14px] leading-relaxed">{obj}</span>
                        </div>
                      );
                    });
                  }
                })()}
              </div>
            </div>
          )}

          {/* 2. Nội dung bài học (Article Content) */}
          {lesson.hasArticle && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📖</span>
                <h3 className="font-bold text-gray-900 text-[16px]">Nội dung chi tiết</h3>
              </div>
              
              <div 
                className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-[15px] leading-relaxed text-gray-700
                /* ÉP KIỂU CSS CHO CÁC THẺ HTML BÊN TRONG CỦA GIẢNG VIÊN */
                [&>h1]:text-2xl [&>h1]:font-extrabold [&>h1]:mb-4 [&>h1]:text-gray-900 [&>h1]:mt-6 first:[&>h1]:mt-0
                [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:text-gray-900 [&>h2]:mt-5 first:[&>h2]:mt-0
                [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:text-gray-900 [&>h3]:mt-4
                [&>p]:mb-4 last:[&>p]:mb-0
                [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ul>li]:mb-1
                [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>ol>li]:mb-1
                [&>strong]:font-bold [&>strong]:text-gray-900
                [&>a]:text-blue-600 [&>a]:underline hover:[&>a]:text-blue-800"
                dangerouslySetInnerHTML={{ __html: lesson.articleContent || "<p class='italic text-gray-400'>Giảng viên chưa soạn nội dung cho bài này.</p>" }}
              />
            </div>
          )}
          {/* 3. Code Example */}
          {lesson.codeExample && (
            <div className="mt-8 mb-8">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900 text-[15px]">Ví dụ Code</h3>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(lesson.codeExample || '');
                    alert('Đã copy code!');
                  }}
                  className="text-gray-500 hover:text-gray-900 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy code
                </button>
              </div>
              <div className="bg-[#0f172a] rounded-xl p-5 font-mono text-[13px] leading-relaxed overflow-x-auto shadow-sm text-emerald-400 whitespace-pre-wrap">
                {lesson.codeExample}
              </div>
            </div>
          )}

          {/* Footer Hành động (Nút Figma) */}
          <div className="mt-12 flex items-center gap-3 border-t border-gray-100 pt-8">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Đánh dấu hoàn thành
            </button>
            <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              Luyện tập topic này
            </button>
          </div>
          
        </div>
      </div>

      {/* ==============================================================
          CỘT PHẢI: THỐNG KÊ (CHUẨN FIGMA)
      ============================================================== */}
      <div className="w-[320px] border-l border-gray-100 bg-gray-50/30 overflow-y-auto shrink-0">
        <div className="p-6 space-y-8">
          
          {/* Tiến độ (Your Progress) */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-[14px]">Your Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                  <span>Khóa học này</span>
                  <span className="text-blue-600 font-bold">{course.progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${course.progressPercent}%` }}></div>
                </div>
              </div>
              <div className="flex justify-between text-[13px] text-gray-600 border-b border-gray-100 pb-2">
                <span>Lessons done</span>
                <span className="font-bold text-gray-900">{course.completedCount}/{course.totalLessons}</span>
              </div>
            </div>
          </div>

          {/* Bài tập liên quan */}
          {lesson.exercises && lesson.exercises.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-4 text-[14px]">Bài tập liên quan</h3>
              <div className="space-y-2">
                {lesson.exercises.map((ex) => (
                  <div key={ex.id} className="bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-xl">💻</div>
                      <div>
                        <h4 className="text-[13px] font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{ex.title}</h4>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded mt-1 inline-block
                          ${ex.difficultyLevel === 1 ? 'text-emerald-600 bg-emerald-50' : 
                            ex.difficultyLevel === 2 ? 'text-amber-600 bg-amber-50' : 
                            'text-red-600 bg-red-50'}`}
                        >
                          {ex.difficultyLevel === 1 ? 'Dễ' : ex.difficultyLevel === 2 ? 'Trung bình' : 'Khó'}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommended Block */}
          <div className="bg-gradient-to-b from-blue-50 to-white border border-blue-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">★</div>
              <h3 className="font-bold text-blue-900 text-[13px]">AI Recommended</h3>
            </div>
            <p className="text-[12px] text-gray-600 mb-4 leading-relaxed">
              Sau bài này, AI đề xuất bạn làm <span className="font-bold text-blue-600">bài tập liên quan</span> để củng cố kiến thức trước khi đi tiếp.
            </p>
            <button className="w-full bg-white border border-blue-200 text-blue-600 font-bold py-2 rounded-lg text-xs hover:bg-blue-50 transition-colors shadow-sm">
              Xem lộ trình AI
            </button>
          </div>

          {/* Bước tiếp theo (Next Step) */}
          {nextLesson && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3 text-[13px] text-gray-500 uppercase tracking-wider">Bước tiếp theo</h3>
              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                <h4 className="font-bold text-gray-900 mb-1 line-clamp-1">{nextLesson.title}</h4>
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">🕒 {nextLesson.duration}</p>
                <button 
                  onClick={() => handleNavigate(nextLesson.id, nextLesson.status)}
                  className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-2 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                >
                  Xem bài tiếp theo
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}