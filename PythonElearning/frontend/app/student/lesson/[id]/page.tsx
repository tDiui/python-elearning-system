"use client";

import { useState, useEffect, use, useRef } from 'react';
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
  courseId: number;
  title: string;
  chapter: string;
  duration: number;
  difficulty: string;
  hasVideo: boolean;
  videoUrl: string | null;
  hasArticle: boolean;
  articleContent: string | null;
  hasSlide: boolean;
  slideUrl: string | null;
  slideOriginalUrl: string | null;
  objectives: string | null; 
  codeExample: string | null;
  exercises: ExerciseItem[];
}

interface CourseItem {
  id: number;
  title: string;
  duration: string;
  status: 'completed' | 'in-progress' | 'not-started' | 'locked';
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

type LessonContentTab = 'video' | 'slide' | 'document';

const getVideoPresentation = (value: string): { type: 'youtube' | 'file' | 'embed'; src: string } | null => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      const videoId = host === 'youtu.be'
        ? pathParts[0]
        : url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(pathParts[0]) ? pathParts[1] : null);
      if (videoId && /^[\w-]{11}$/.test(videoId)) {
        return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${videoId}` };
      }
      return null;
    }

    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
      return { type: 'file', src: url.toString() };
    }
    return { type: 'embed', src: url.toString() };
  } catch {
    return null;
  }
};

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [lessonAccessError, setLessonAccessError] = useState('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [slidePreview, setSlidePreview] = useState<{ lessonId: number; slideUrl: string; url: string } | null>(null);
  const [slideError, setSlideError] = useState<{ lessonId: number; slideUrl: string; message: string } | null>(null);
  const [selectedContentTab, setSelectedContentTab] = useState<{ lessonId: number; tab: LessonContentTab } | null>(null);
  const contentScrollerRef = useRef<HTMLDivElement>(null);

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

        if (lessonData.success) {
          setLessonAccessError('');
          setLesson(lessonData.data);
          const matchingCourseRes = await fetch(
            `http://localhost:5000/api/student/courses?courseId=${lessonData.data.courseId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const matchingCourseData = await matchingCourseRes.json();
          if (matchingCourseData.success) setCourse(matchingCourseData.data);
        }
        if (!lessonData.success) {
          setLessonAccessError(lessonData.message || 'Bài học hiện không khả dụng.');
          setLesson(null);
        }
        if (!lessonData.success && courseData.success) setCourse(courseData.data);

      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  useEffect(() => {
    const scroller = contentScrollerRef.current;
    if (!lesson || !scroller) return;
    const storageKey = `lesson-scroll:${lesson.id}`;
    const savedScrollPosition = Number.parseInt(localStorage.getItem(storageKey) || '0', 10);
    if (Number.isFinite(savedScrollPosition)) scroller.scrollTop = savedScrollPosition;

    const saveScrollPosition = () => {
      localStorage.setItem(storageKey, String(scroller.scrollTop));
    };
    scroller.addEventListener('scroll', saveScrollPosition, { passive: true });

    const token = localStorage.getItem('token');
    let active = true;
    let lastTick = Date.now();
    let pendingMilliseconds = 0;
    let interval = 0;
    const sendTime = async (seconds: number, keepalive = false) => {
      if (!token || !active) return;
      try {
        const response = await fetch(`http://localhost:5000/api/student/lesson/${lesson.id}/time`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seconds }),
          keepalive,
        });
        if (!response.ok) {
          const payload = await response.json();
          if (response.status === 403 || response.status === 404) {
            active = false;
            window.clearInterval(interval);
            setLessonAccessError(payload.message || 'Bạn không còn quyền truy cập bài học này.');
            setLesson(null);
            return;
          }
          throw new Error(payload.message || 'Không thể lưu thời gian học.');
        }
      } catch (requestError) {
        console.error('Lỗi ghi nhận thời gian học:', requestError);
      }
    };
    const recordElapsed = (includeFinalVisibleInterval = false, keepalive = false) => {
      if (!active) return;
      const now = Date.now();
      if (document.visibilityState === 'visible' || includeFinalVisibleInterval) {
        pendingMilliseconds += now - lastTick;
      }
      lastTick = now;
      const seconds = Math.min(300, Math.floor(pendingMilliseconds / 1000));
      if (seconds > 0) {
        pendingMilliseconds -= seconds * 1000;
        void sendTime(seconds, keepalive);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordElapsed(true);
      } else {
        lastTick = Date.now();
      }
    };
    interval = window.setInterval(() => {
      if (active) recordElapsed();
    }, 15000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      recordElapsed(document.visibilityState === 'visible', true);
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      scroller.removeEventListener('scroll', saveScrollPosition);
      saveScrollPosition();
    };
  }, [lesson, loading]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!lesson?.hasSlide || !lesson.slideUrl) {
      return;
    }

    const lessonId = lesson.id;
    const slideUrl = lesson.slideUrl;
    if (!slideUrl.startsWith('/api/student/lesson/')) {
      return;
    }

    const token = localStorage.getItem('token');
    const loadSlide = async () => {
      try {
        if (!token) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem slide.');
        }
        const response = await fetch(`http://localhost:5000${slideUrl}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.message || 'Không thể tải bản xem trước slide.');
        }
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setSlidePreview({ lessonId, slideUrl, url: objectUrl });
      } catch (requestError) {
        console.error('Lỗi tải bản xem trước slide:', requestError);
        if (active) {
          setSlideError({
            lessonId,
            slideUrl,
            message: requestError instanceof Error ? requestError.message : 'Không thể tải bản xem trước slide.',
          });
        }
      }
    };
    void loadSlide();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lesson?.id, lesson?.hasSlide, lesson?.slideUrl]);

  const downloadOriginalSlide = async () => {
    if (!lesson?.slideOriginalUrl) return;
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000${lesson.slideOriginalUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || 'Không thể tải file PowerPoint gốc.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = lesson.slideOriginalUrl.includes('.pptx') ? 'lesson-slide.pptx' : 'lesson-slide.ppt';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      console.error('Lỗi tải file PowerPoint:', requestError);
      setSlideError({
        lessonId: lesson.id,
        slideUrl: lesson.slideUrl || '',
        message: requestError instanceof Error ? requestError.message : 'Không thể tải file PowerPoint gốc.',
      });
    }
  };

  const handleCompleteLesson = async () => {
    const token = localStorage.getItem('token');
    if (!lesson || !course || !token) {
      router.push('/login');
      return;
    }

    setCompleting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/student/lesson/${lesson.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật tiến độ bài học.');
      }
      setCourse(current => current ? {
        ...current,
        progressPercent: payload.data.progressPercent,
        completedCount: payload.data.completedCount,
        chapters: current.chapters.map(chapter => ({
          ...chapter,
          lessons: chapter.lessons.map(item =>
            item.id === lesson.id ? { ...item, status: 'completed' } : item
          ),
        })),
      } : current);
    } catch (requestError) {
      console.error('Lỗi hoàn thành bài học:', requestError);
      window.alert(requestError instanceof Error ? requestError.message : 'Không thể cập nhật tiến độ bài học.');
    } finally {
      setCompleting(false);
    }
  };

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
  const videoPresentation = lesson?.videoUrl ? getVideoPresentation(lesson.videoUrl) : null;
  const availableContentTabs: { id: LessonContentTab; label: string; icon: string }[] = lesson
    ? [
        ...(lesson.hasVideo ? [{ id: 'video' as const, label: 'Video', icon: '🎬' }] : []),
        ...(lesson.hasSlide && lesson.slideUrl ? [{ id: 'slide' as const, label: 'Slide', icon: '📊' }] : []),
        ...(lesson.hasArticle ? [{ id: 'document' as const, label: 'Tài liệu', icon: '📄' }] : []),
      ]
    : [];
  const activeContentTab = lesson
    ? selectedContentTab?.lessonId === lesson.id &&
      availableContentTabs.some(tab => tab.id === selectedContentTab.tab)
      ? selectedContentTab.tab
      : availableContentTabs[0]?.id
    : undefined;

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-medium">Đang tải dữ liệu thực...</div>;
  if (!lesson || !course) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p role="alert" className="text-gray-600">{lessonAccessError || 'Không tìm thấy dữ liệu khóa học!'}</p>
        <button
          type="button"
          onClick={() => router.push('/student/courses')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Quay lại khóa học
        </button>
      </div>
    );
  }

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
      <div ref={contentScrollerRef} className="flex-1 overflow-y-auto">
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
              {lesson.duration > 0 ? `${lesson.duration} phút` : 'Chưa đặt thời lượng'}
            </span>
            <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">{lesson.difficulty === 'Beginner' ? 'Cơ bản' : lesson.difficulty === 'Intermediate' ? 'Trung bình' : 'Nâng cao'}</span>
          </div>

          {availableContentTabs.length > 0 ? (
            <section className="mb-8">
              <div
                role="tablist"
                aria-label="Nội dung bài học"
                className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
              >
                {availableContentTabs.map(tab => (
                  <button
                    key={tab.id}
                    id={`lesson-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeContentTab === tab.id}
                    aria-controls="lesson-content-panel"
                    onClick={() => setSelectedContentTab({ lessonId: lesson.id, tab: tab.id })}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      activeContentTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                id="lesson-content-panel"
                role="tabpanel"
                aria-labelledby={`lesson-tab-${activeContentTab}`}
              >
                {activeContentTab === 'video' && (
                  <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-[#1b1d4b] shadow-sm">
                    {videoPresentation?.type === 'file' ? (
                      <video
                        src={videoPresentation.src}
                        controls
                        playsInline
                        preload="metadata"
                        className="h-full w-full"
                      >
                        Trình duyệt không hỗ trợ phát video này.
                      </video>
                    ) : videoPresentation ? (
                      <iframe
                        title={`Video bài học: ${lesson.title}`}
                        src={videoPresentation.src}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : lesson.videoUrl ? (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-white">
                        <p>
                          Không thể nhúng liên kết video này.{' '}
                          <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                            Mở video trong tab mới
                          </a>
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white">
                        Video đang được cập nhật...
                      </div>
                    )}
                  </div>
                )}

                {activeContentTab === 'slide' && lesson.hasSlide && lesson.slideUrl && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-bold text-gray-900">Slide bài học</h2>
                      <div className="flex flex-wrap items-center gap-3">
                        {lesson.slideOriginalUrl && (
                          <button
                            type="button"
                            onClick={() => void downloadOriginalSlide()}
                            className="text-sm font-semibold text-blue-600 hover:underline"
                          >
                            Tải PowerPoint gốc
                          </button>
                        )}
                        {!lesson.slideOriginalUrl && (
                          <a
                            href={lesson.slideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-blue-600 hover:underline"
                          >
                            Mở hoặc tải PDF
                          </a>
                        )}
                      </div>
                    </div>
                    {slideError?.lessonId === lesson.id && slideError.slideUrl === lesson.slideUrl ? (
                      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{slideError.message}</p>
                    ) : !lesson.slideUrl.startsWith('/api/student/lesson/') ? (
                      <iframe
                        title={`Slide bài học: ${lesson.title}`}
                        src={lesson.slideUrl}
                        className="h-[520px] w-full rounded-lg border border-gray-100"
                      />
                    ) : slidePreview?.lessonId === lesson.id && slidePreview.slideUrl === lesson.slideUrl ? (
                      <iframe
                        title={`Slide bài học: ${lesson.title}`}
                        src={slidePreview.url}
                        className="h-[520px] w-full rounded-lg border border-gray-100"
                      />
                    ) : (
                      <p className="py-12 text-center text-sm text-gray-500">Đang tải bản xem trước slide...</p>
                    )}
                  </div>
                )}

                {activeContentTab === 'document' && (
                  <article
                    className="min-h-64 rounded-xl border border-gray-100 bg-white p-6 text-[15px] leading-relaxed text-gray-700 shadow-sm sm:p-8
                    [&>h1]:mt-6 [&>h1]:mb-4 [&>h1]:text-2xl [&>h1]:font-extrabold [&>h1]:text-gray-900 first:[&>h1]:mt-0
                    [&>h2]:mt-5 [&>h2]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 first:[&>h2]:mt-0
                    [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-gray-900
                    [&>p]:mb-4 last:[&>p]:mb-0
                    [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:mb-1
                    [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol>li]:mb-1
                    [&>strong]:font-bold [&>strong]:text-gray-900
                    [&>a]:text-blue-600 [&>a]:underline hover:[&>a]:text-blue-800"
                    dangerouslySetInnerHTML={{
                      __html: lesson.articleContent || "<p class='italic text-gray-400'>Giảng viên chưa soạn nội dung cho tài liệu này.</p>",
                    }}
                  />
                )}
              </div>
            </section>
          ) : (
            <div className="mb-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Bài học chưa có video, slide hoặc tài liệu.
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
                  } catch {
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
            <button
              type="button"
              onClick={() => void handleCompleteLesson()}
              disabled={completing || course.chapters.some(chapter => chapter.lessons.some(item => item.id === lesson.id && item.status === 'completed'))}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              {completing ? 'Đang lưu...' : course.chapters.some(chapter => chapter.lessons.some(item => item.id === lesson.id && item.status === 'completed')) ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
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
                  <div 
                        key={ex.id} 
                        // THÊM SỰ KIỆN CLICK VÀO ĐÂY:
                        onClick={() => router.push(`/student/exercises/${ex.id}`)} 
                        className="bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all group"
                      >
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