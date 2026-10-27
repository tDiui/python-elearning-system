"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LoaderCircle,
  Map,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api/student';
const GENERATE_PATH_ENDPOINT = `${API_BASE_URL}/learning-path/generate`;

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type Course = {
  id: number;
  title: string;
  description?: string;
  progressPercent?: number;
  totalLessons?: number;
};

type KnowledgeSkill = {
  name: string;
  score: number;
  color?: string;
};

type LearningPathStep = {
  id: number;
  title: string;
  difficulty: string;
  reason: string;
  durationMinutes: number;
  isCompleted: boolean;
  isLocked: boolean;
  targetType: 'Lesson' | 'Exercise';
  targetId: number | null;
};

type Dashboard = {
  overallMastery?: number;
  avgScore?: number;
  studyTimeHours?: number;
  totalLessonsLearned?: number;
  completedExercises?: number;
  knowledgeMap?: KnowledgeSkill[];
  learningPath?: LearningPathStep[];
  learningPathTitle?: string | null;
  learningPathSource?: 'AI' | 'Fallback' | null;
};

type GeneratedPath = {
  pathId?: number;
  title: string;
  usedFallback: boolean;
  itemsCount: number;
  items: LearningPathStep[];
};

type GeneratedPathResult = Omit<GeneratedPath, 'items'> & { pathId: number };

const getSavedPath = (dashboard: Dashboard | null): GeneratedPath | null => {
  const items = dashboard?.learningPath || [];
  if (!items.length) return null;

  return {
    title: dashboard?.learningPathTitle || 'Lộ trình học tập cá nhân hóa',
    usedFallback: dashboard?.learningPathSource === 'Fallback',
    itemsCount: items.length,
    items
  };
};

const readApiResponse = async <T,>(response: Response): Promise<ApiResponse<T>> => {
  let payload: ApiResponse<T>;
  try {
    payload = await response.json() as ApiResponse<T>;
  } catch {
    if (response.status === 404) {
      throw new Error('API này chưa được khai báo. Vui lòng kiểm tra lại sau khi backend cập nhật route lộ trình.');
    }
    throw new Error(`Máy chủ trả về phản hồi không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
  }
  return payload;
};

export default function LearningPathPage() {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [generatedPath, setGeneratedPath] = useState<GeneratedPath | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const requestPageData = useCallback(async (token: string, signal?: AbortSignal) => {
    const headers = { Authorization: `Bearer ${token}` };
    const [courseResponse, dashboardResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/courses`, { headers, signal }),
      fetch(`${API_BASE_URL}/dashboard`, { headers, signal }),
    ]);
    const [coursePayload, dashboardPayload] = await Promise.all([
      readApiResponse<Course | null>(courseResponse),
      readApiResponse<Dashboard>(dashboardResponse),
    ]);

    return {
      course: coursePayload.data || null,
      dashboard: dashboardPayload.data || null,
    };
  }, []);

  const handleReload = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setError('');
    setLoading(true);
    void requestPageData(token)
      .then(({ course: nextCourse, dashboard: nextDashboard }) => {
        setCourse(nextCourse);
        setDashboard(nextDashboard);
        setGeneratedPath(getSavedPath(nextDashboard));
        setGeneratedMessage(nextDashboard?.learningPath?.length
          ? 'Đang hiển thị lộ trình đã lưu cho khóa học này.'
          : '');
      })
      .catch((fetchError: unknown) => {
        console.error('Lỗi tải dữ liệu trang lộ trình học tập:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải dữ liệu học tập.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return () => controller.abort();
    }

    void requestPageData(token, controller.signal)
      .then(({ course: nextCourse, dashboard: nextDashboard }) => {
        setCourse(nextCourse);
        setDashboard(nextDashboard);
        setGeneratedPath(getSavedPath(nextDashboard));
        setGeneratedMessage(nextDashboard?.learningPath?.length
          ? 'Đang hiển thị lộ trình đã lưu cho khóa học này.'
          : '');
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        console.error('Lỗi tải dữ liệu trang lộ trình học tập:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải dữ liệu học tập.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestPageData, router]);

  const handleGeneratePath = async () => {
    if (!course || generating) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedPath(null);

    try {
      const response = await fetch(GENERATE_PATH_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId: course.id }),
      });
      const payload = await readApiResponse<GeneratedPathResult>(response);

      if (!payload.data || !Number.isInteger(payload.data.pathId)) {
        throw new Error('Phản hồi tạo lộ trình không có dữ liệu hợp lệ.');
      }

      setGeneratedPath({ ...payload.data, items: [] });
      setGeneratedMessage(payload.message || 'Đã tạo lộ trình học tập.');

      try {
        const refreshedData = await requestPageData(token);
        setCourse(refreshedData.course);
        setDashboard(refreshedData.dashboard);
        const savedPath = getSavedPath(refreshedData.dashboard);
        if (savedPath) setGeneratedPath(savedPath);
      } catch (refreshError) {
        console.error('Lộ trình đã tạo nhưng không tải lại được các bước:', refreshError);
      }
    } catch (generationError) {
      console.error('Lỗi tạo lộ trình học tập:', generationError);
      setError(generationError instanceof Error
        ? generationError.message
        : 'Không thể tạo lộ trình. Vui lòng thử lại.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 font-medium text-gray-500">
          <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
          Đang tải dữ liệu học tập...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-12">
      <section className="relative overflow-hidden rounded-2xl bg-[#1956E3] p-7 text-white shadow-sm sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
              <Sparkles className="h-3.5 w-3.5" />
              HỌC TẬP CÁ NHÂN HÓA
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lộ trình học tập của tôi</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Tạo kế hoạch học phù hợp với tiến độ và kết quả thực tế của bạn trong khóa học.
            </p>
          </div>
          <div className="flex h-24 w-24 shrink-0 items-center justify-center self-start rounded-2xl border border-white/15 bg-white/10 lg:self-center">
            <Map className="h-12 w-12 text-white" strokeWidth={1.5} />
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex shrink-0 items-center gap-2 font-semibold text-red-700 hover:text-red-900"
          >
            <RefreshCw className="h-4 w-4" />
            Tải lại dữ liệu
          </button>
        </div>
      )}

      {!course ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Bạn chưa có khóa học đang tham gia</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
            Hãy đăng ký và được duyệt vào một khóa học trước khi tạo lộ trình học tập cá nhân.
          </p>
          <Link
            href="/student/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Khám phá khóa học
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Khóa học đang học</p>
                    <h2 className="mt-1 text-lg font-bold text-gray-900">{course.title}</h2>
                    {course.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-500">{course.description}</p>
                    )}
                  </div>
                </div>
                <Link href="/student/courses" className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Xem khóa học
                </Link>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600">Tiến độ khóa học</span>
                  <span className="font-bold text-gray-900">{Math.round(course.progressPercent || 0)}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-label="Tiến độ khóa học"
                  aria-valuenow={Math.min(100, Math.max(0, course.progressPercent || 0))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, course.progressPercent || 0))}%` }}
                  />
                </div>
                {typeof course.totalLessons === 'number' && (
                  <p className="mt-2 text-xs text-gray-400">{course.totalLessons} bài học trong khóa học</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Tạo lộ trình bằng AI</h2>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    AI sẽ dựa trên dữ liệu tiến độ, kết quả theo chủ đề và nội dung khóa học để đề xuất các bước tiếp theo.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <Target className="mb-3 h-5 w-5 text-rose-500" />
                  <p className="text-xl font-bold text-gray-900">{dashboard?.avgScore ?? 0}%</p>
                  <p className="mt-1 text-xs text-gray-500">Điểm trung bình</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-500" />
                  <p className="text-xl font-bold text-gray-900">{dashboard?.totalLessonsLearned ?? 0}</p>
                  <p className="mt-1 text-xs text-gray-500">Bài học đã hoàn thành</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <Clock3 className="mb-3 h-5 w-5 text-amber-500" />
                  <p className="text-xl font-bold text-gray-900">{dashboard?.studyTimeHours ?? 0}h</p>
                  <p className="mt-1 text-xs text-gray-500">Thời gian học</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePath}
                disabled={generating}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
              >
                {generating ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    AI đang phân tích dữ liệu; có thể mất vài phút...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {generatedPath ? 'Tạo lại lộ trình' : 'Tạo lộ trình học tập'}
                  </>
                )}
              </button>

              {generatedPath && (
                <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-emerald-900">{generatedPath.title}</p>
                      <p className="mt-1 text-sm leading-5 text-emerald-800">{generatedMessage}</p>
                      <p className="mt-2 text-xs text-emerald-700">
                        {generatedPath.itemsCount} bước học
                        {generatedPath.usedFallback ? ' · Được tạo bằng phương án dự phòng' : ' · Được cá nhân hóa bằng AI'}
                      </p>
                      {generatedPath.items.length > 0 && (
                        <ol className="mt-4 space-y-2 border-t border-emerald-200 pt-3">
                          {generatedPath.items.map((item, index) => {
                            const href = item.targetId
                              ? item.targetType === 'Lesson'
                                ? `/student/lesson/${item.targetId}`
                                : `/student/exercises/${item.targetId}`
                              : null;
                            return (
                              <li key={item.id} className="rounded-lg bg-white/80 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {index + 1}. {item.title}
                                  </p>
                                  <span className="text-xs text-gray-500">
                                    {item.targetType === 'Lesson' ? 'Bài học' : 'Bài tập'}
                                    {item.durationMinutes > 0 ? ` · ${item.durationMinutes} phút` : ''}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-gray-600">{item.reason}</p>
                                {href && (
                                  <Link
                                    href={href}
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                                  >
                                    Mở nội dung <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <h2 className="font-bold text-gray-900">Tổng quan học tập</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xl font-bold text-blue-700">{dashboard?.overallMastery ?? 0}%</p>
                  <p className="mt-1 text-xs text-blue-700/70">Mức độ nắm vững</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xl font-bold text-emerald-700">{dashboard?.completedExercises ?? 0}</p>
                  <p className="mt-1 text-xs text-emerald-700/70">Bài tập hoàn thành</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">Bản đồ kiến thức</h2>
                <span className="text-xs text-gray-400">Dữ liệu hiện có</span>
              </div>
              {dashboard?.knowledgeMap?.length ? (
                <div className="flex flex-col gap-4">
                  {dashboard.knowledgeMap.slice(0, 6).map((skill) => (
                    <div key={skill.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-gray-600" title={skill.name}>{skill.name}</span>
                        <span className="shrink-0 font-semibold text-gray-700">{Math.round(skill.score)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${Math.min(100, Math.max(0, skill.score))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-gray-50 px-4 py-5 text-center text-sm leading-5 text-gray-500">
                  Chưa có dữ liệu bản đồ kiến thức. Hãy tiếp tục học và làm bài tập để hệ thống ghi nhận tiến độ.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
