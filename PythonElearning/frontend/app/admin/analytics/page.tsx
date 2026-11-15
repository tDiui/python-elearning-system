"use client";

import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  GraduationCap,
  RefreshCw,
  Users
} from 'lucide-react';

type Period = 'week' | 'month' | 'year';
type TrendPoint = {
  key: string;
  label: string;
  enrollments: number;
  learningActivities: number;
  quizAttempts: number;
  aiRoadmaps: number;
};
type AnalyticsData = {
  period: Period;
  range: { start: string; end: string };
  selectedCourseId: number | null;
  courses: { id: number; title: string }[];
  summary: {
    users: { total: number; administrators: number; instructors: number; students: number };
    courses: { total: number; published: number };
    enrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    completionRate: number;
    learningActivities: number;
    quizzes: number;
    quizAttempts: number;
    aiRoadmaps: number;
  };
  trend: TrendPoint[];
};
type ApiResponse<T> = { success: boolean; message?: string; data: T };
type DetailMetric = 'users' | 'courses' | 'enrollments' | 'activities' | 'quizzes' | 'quizAttempts' | 'aiRoadmaps';
type AnalyticsDetail = {
  metric: DetailMetric;
  page: number;
  pageSize: number;
  total: number;
  columns: Array<{ key: string; label: string }>;
  items: Array<Record<string, string | number | null>>;
};

const periodLabels: Record<Period, string> = {
  week: '7 ngày gần đây',
  month: '30 ngày gần đây',
  year: '12 tháng gần đây'
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const response = await fetch(`http://localhost:5000/api/admin${path}`, {
    ...init,
    headers: {
      Authorization: ['Bearer', token].join(' '),
      ...init?.headers
    }
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Không thể tải dữ liệu Analytics.');
  }
  return payload;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full rounded-xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow disabled:cursor-default disabled:hover:border-gray-100 disabled:hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      {onClick && <p className="mt-3 text-xs font-semibold text-blue-600">Xem chi tiết →</p>}
    </button>
  );
}

function TrendChart({
  title,
  points,
  metric,
  color,
  period
}: {
  title: string;
  points: TrendPoint[];
  metric: keyof Pick<TrendPoint, 'enrollments' | 'learningActivities' | 'quizAttempts' | 'aiRoadmaps'>;
  color: string;
  period: Period;
}) {
  const values = points.map((point) => point[metric]);
  const maximum = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const step = period === 'month' ? 5 : 1;

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs text-gray-500">Tổng trong kỳ: {total.toLocaleString('vi-VN')}</p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
      </div>
      {total === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
          Chưa có dữ liệu trong khoảng thời gian này.
        </div>
      ) : (
        <div role="img" aria-label={`${title} theo ${period === 'year' ? 'tháng' : 'ngày'}`} className="flex h-36 items-end gap-1 border-b border-gray-200 px-1">
          {points.map((point) => {
            const value = point[metric];
            const height = value === 0 ? 2 : Math.max(8, (value / maximum) * 100);
            return (
              <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  title={`${point.label}: ${value.toLocaleString('vi-VN')}`}
                  className={`w-full rounded-t-sm ${color}`}
                  style={{ height: `${height}%`, minHeight: value === 0 ? 2 : undefined }}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[10px] text-gray-400" aria-hidden="true">
        {points.filter((_, index) => index % step === 0 || index === points.length - 1).map((point) => (
          <span key={point.key}>{point.label}</span>
        ))}
      </div>
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [courseId, setCourseId] = useState('all');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [detailMetric, setDetailMetric] = useState<DetailMetric | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailData, setDetailData] = useState<AnalyticsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ period });
    if (courseId !== 'all') query.set('courseId', courseId);

    const fetchAnalytics = async () => {
      try {
        const result = await adminRequest<AnalyticsData>(`/analytics?${query.toString()}`);
        if (controller.signal.aborted) return;
        setData(result.data);
        setUpdatedAt(new Date());
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Lỗi tải Analytics quản trị:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu Analytics.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchAnalytics();
    return () => controller.abort();
  }, [period, courseId, refreshKey]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setLoading(true);
      setError('');
      setRefreshKey((key) => key + 1);
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, []);

  useEffect(() => {
    if (!detailMetric) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      metric: detailMetric,
      period,
      page: String(detailPage)
    });
    if (courseId !== 'all') query.set('courseId', courseId);

    const fetchDetails = async () => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const result = await adminRequest<AnalyticsDetail>(`/analytics/details?${query.toString()}`, {
          signal: controller.signal
        });
        if (!controller.signal.aborted) setDetailData(result.data);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Lỗi tải chi tiết Analytics:', loadError);
        setDetailError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu chi tiết.');
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    };

    void fetchDetails();
    return () => controller.abort();
  }, [detailMetric, detailPage, period, courseId]);

  const openDetails = (metric: DetailMetric) => {
    setDetailData(null);
    setDetailPage(1);
    setDetailError('');
    setDetailMetric(metric);
  };

  const summary = data?.summary;
  const detailScope = detailMetric === 'users'
    ? 'Danh sách người dùng hiện tại trên toàn hệ thống'
    : detailMetric === 'courses'
      ? 'Danh sách khóa học hiện tại theo bộ lọc'
      : detailMetric === 'quizzes'
        ? 'Bài kiểm tra hiện có theo khóa học được chọn'
        : 'Dữ liệu theo bộ lọc thời gian và khóa học hiện tại';
  const cards = [
    {
      label: 'Tổng người dùng',
      value: summary?.users.total.toLocaleString('vi-VN') ?? '—',
      detail: `${summary?.users.students ?? 0} học viên · ${summary?.users.instructors ?? 0} giảng viên · ${summary?.users.administrators ?? 0} quản trị viên`,
      icon: Users,
      tone: 'bg-blue-50 text-blue-600',
      onClick: () => openDetails('users')
    },
    {
      label: 'Khóa học đang hoạt động',
      value: summary?.courses.published.toLocaleString('vi-VN') ?? '—',
      detail: `Trong tổng số ${summary?.courses.total.toLocaleString('vi-VN') ?? 0} khóa học`,
      icon: BookOpen,
      tone: 'bg-violet-50 text-violet-600',
      onClick: () => openDetails('courses')
    },
    {
      label: 'Lượt đăng ký trong kỳ',
      value: summary?.enrollments.toLocaleString('vi-VN') ?? '—',
      detail: periodLabels[period],
      icon: GraduationCap,
      tone: 'bg-cyan-50 text-cyan-600',
      onClick: () => openDetails('enrollments')
    },
    {
      label: 'Tỷ lệ hoàn thành',
      value: `${summary?.completionRate ?? 0}%`,
      detail: `${summary?.completedEnrollments.toLocaleString('vi-VN') ?? 0} / ${summary?.activeEnrollments.toLocaleString('vi-VN') ?? 0} lượt đăng ký đang học hoàn thành`,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-600',
      onClick: () => openDetails('enrollments')
    }
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Admin&nbsp; › &nbsp;Analytics</p>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích hệ thống</h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi người dùng, khóa học và hoạt động học tập từ dữ liệu hệ thống.</p>
          {updatedAt && <p className="mt-2 text-xs text-gray-400">Cập nhật lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              setRefreshKey((key) => key + 1);
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            Xuất PDF
          </button>
        </div>
      </header>

      <section aria-label="Bộ lọc Analytics" className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end print:hidden">
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-600">
          Khoảng thời gian
          <select
            value={period}
            onChange={(event) => {
              setLoading(true);
              setError('');
              setPeriod(event.target.value as Period);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="week">7 ngày gần đây</option>
            <option value="month">30 ngày gần đây</option>
            <option value="year">12 tháng gần đây</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold text-gray-600">
          Khóa học
          <select
            value={courseId}
            onChange={(event) => {
              setLoading(true);
              setError('');
              setCourseId(event.target.value);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Tất cả khóa học</option>
            {data?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <p className="text-xs text-gray-400 sm:pb-2.5">
          {data?.range.start && data.range.end
            ? `${new Intl.DateTimeFormat('vi-VN').format(new Date(data.range.start))} – ${new Intl.DateTimeFormat('vi-VN').format(new Date(data.range.end))}`
            : 'Đang chuẩn bị khoảng thời gian...'}
        </p>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center text-sm font-medium text-gray-500">
          <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Đang tải số liệu Analytics...</span>
        </div>
      ) : data ? (
        <>
          {loading && <p role="status" className="text-xs text-blue-600">Đang cập nhật dữ liệu…</p>}

          <section aria-label="Chỉ số tổng quan" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => <MetricCard key={card.label} {...card} />)}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Hoạt động học tập"
              value={summary?.learningActivities.toLocaleString('vi-VN') ?? 0}
              detail={periodLabels[period]}
              icon={Activity}
              tone="bg-amber-50 text-amber-600"
              onClick={() => openDetails('activities')}
            />
            <MetricCard
              label="Bài kiểm tra"
              value={summary?.quizzes.toLocaleString('vi-VN') ?? 0}
              detail="Tổng số quiz hiện có"
              icon={BookOpen}
              tone="bg-indigo-50 text-indigo-600"
              onClick={() => openDetails('quizzes')}
            />
            <MetricCard
              label="Lượt làm bài kiểm tra"
              value={summary?.quizAttempts.toLocaleString('vi-VN') ?? 0}
              detail={periodLabels[period]}
              icon={CheckCircle2}
              tone="bg-rose-50 text-rose-600"
              onClick={() => openDetails('quizAttempts')}
            />
            <MetricCard
              label="Lượt sử dụng AI Lộ trình"
              value={summary?.aiRoadmaps.toLocaleString('vi-VN') ?? 0}
              detail={periodLabels[period]}
              icon={Bot}
              tone="bg-fuchsia-50 text-fuchsia-600"
              onClick={() => openDetails('aiRoadmaps')}
            />
          </section>

          <section aria-label="Xu hướng hoạt động theo thời gian" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <TrendChart title="Lượt đăng ký khóa học" points={data.trend} metric="enrollments" color="bg-blue-500" period={period} />
            <TrendChart title="Hoạt động học tập" points={data.trend} metric="learningActivities" color="bg-amber-500" period={period} />
            <TrendChart title="Lượt làm bài kiểm tra" points={data.trend} metric="quizAttempts" color="bg-rose-500" period={period} />
            <TrendChart title="Lượt sử dụng AI Lộ trình" points={data.trend} metric="aiRoadmaps" color="bg-fuchsia-500" period={period} />
          </section>

          <details className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-gray-800">Xem bảng số liệu chi tiết</summary>
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Thời điểm</th>
                    <th className="px-4 py-3 font-semibold">Đăng ký</th>
                    <th className="px-4 py-3 font-semibold">Hoạt động học</th>
                    <th className="px-4 py-3 font-semibold">Lượt làm quiz</th>
                    <th className="px-4 py-3 font-semibold">Lượt dùng AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.trend.map((point) => (
                    <tr key={point.key}>
                      <td className="px-5 py-3 font-medium text-gray-700">{point.label}</td>
                      <td className="px-4 py-3 text-gray-600">{point.enrollments.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-gray-600">{point.learningActivities.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-gray-600">{point.quizAttempts.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-gray-600">{point.aiRoadmaps.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {detailMetric && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDetailMetric(null);
            }}>
              <section role="dialog" aria-modal="true" aria-labelledby="analytics-detail-title" className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
                <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                  <div>
                    <h2 id="analytics-detail-title" className="text-lg font-bold text-gray-900">
                      {detailMetric === 'users' ? 'Người dùng' :
                        detailMetric === 'courses' ? 'Khóa học' :
                          detailMetric === 'enrollments' ? 'Lượt đăng ký' :
                            detailMetric === 'activities' ? 'Hoạt động học tập' :
                              detailMetric === 'quizzes' ? 'Bài kiểm tra' :
                                detailMetric === 'quizAttempts' ? 'Lượt làm bài kiểm tra' : 'Lộ trình AI'}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {detailData ? `${detailData.total.toLocaleString('vi-VN')} bản ghi · trang ${detailPage}` : detailScope}
                    </p>
                  </div>
                  <button type="button" onClick={() => setDetailMetric(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Đóng</button>
                </header>
                {detailError && <p role="alert" className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{detailError}</p>}
                <div className="max-h-[60vh] overflow-auto">
                  {detailLoading && !detailData ? (
                    <p className="p-8 text-center text-sm text-gray-500">Đang tải dữ liệu chi tiết...</p>
                  ) : detailData?.items.length ? (
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-500">
                        <tr>
                          {detailData.columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailData.items.map((item, index) => (
                          <tr key={String(item.id ?? index)} className="align-top">
                            {detailData.columns.map((column) => {
                              const value = item[column.key];
                              const isDate = value !== null && typeof value === 'string' &&
                                /At$|Date$/.test(column.key) && !Number.isNaN(Date.parse(value));
                              return (
                                <td key={column.key} className="max-w-xs px-4 py-3 text-gray-700">
                                  {value === null || value === '' ? '—' :
                                    isDate ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) :
                                    typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : !detailLoading && <p className="p-8 text-center text-sm text-gray-500">Không có dữ liệu chi tiết trong phạm vi đã chọn.</p>}
                </div>
                <footer className="flex items-center justify-between border-t border-gray-100 p-4">
                  <span className="text-xs text-gray-500">
                    {detailData?.total ? `${(detailPage - 1) * (detailData.pageSize) + 1}–${Math.min(detailPage * detailData.pageSize, detailData.total)} / ${detailData.total}` : '0 bản ghi'}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDetailPage((current) => Math.max(1, current - 1))} disabled={detailPage <= 1 || detailLoading} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40">Trước</button>
                    <button type="button" onClick={() => setDetailPage((current) => current + 1)} disabled={!detailData || detailPage * detailData.pageSize >= detailData.total || detailLoading} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40">Tiếp</button>
                  </div>
                </footer>
              </section>
            </div>
          )}

          <section aria-label="Chỉ số chưa có nguồn dữ liệu" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><Users size={17} /> Lượt truy cập hệ thống</div>
              <p className="mt-2 text-2xl font-bold text-gray-400">Chưa có dữ liệu</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Hệ thống hiện chưa lưu lịch sử truy cập để thống kê chỉ số này.</p>
            </article>
            <article className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><Clock3 size={17} /> Hiệu suất hệ thống</div>
              <p className="mt-2 text-2xl font-bold text-gray-400">Chưa có dữ liệu</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Chưa có số liệu đo hiệu suất được lưu trong hệ thống; không thay bằng ước tính.</p>
            </article>
          </section>

          <p className="text-xs leading-5 text-gray-400">
            Người dùng và số khóa học là số liệu hiện tại của toàn hệ thống. Các chỉ số có bộ lọc thời gian được tổng hợp từ các bản ghi phát sinh trong kỳ đã chọn.
          </p>
        </>
      ) : !error ? (
        <p role="status" className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
          Chưa có dữ liệu để thống kê.
        </p>
      ) : null}
    </div>
  );
}
