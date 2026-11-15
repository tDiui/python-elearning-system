"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Award, RefreshCw, Users } from 'lucide-react';

type Student = {
  id: number;
  name: string;
  studentId: string | null;
  avatar: string;
  progress: number;
  avgScore: number | null;
  weakTopics: string[];
  lastActive: string;
  status: string;
  color: string;
};

type CourseOption = { id: number; title: string };
type DashboardData = {
  courseId: number;
  courseName: string;
  totalStudentsClass: number;
  stats: {
    totalStudents: number;
    activeStudents: number;
    courseCompletion: number;
    completedStudents: number;
    inProgressStudents: number;
    notStartedStudents: number;
    avgScore: number | null;
  };
  pendingApprovals: number;
  gradeDistribution: { range: string; count: number; height: string }[];
  hardTopics: { name: string; percent: number; color: string; text: string }[];
  students: Student[];
};
type ApiResponse = {
  success: boolean;
  message?: string;
  data: DashboardData | null;
  courses: CourseOption[];
};
type StudentFilter = 'Tất cả' | 'Đang học' | 'Không hoạt động';

const studentFilters: StudentFilter[] = ['Tất cả', 'Đang học', 'Không hoạt động'];

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [filter, setFilter] = useState<StudentFilter>('Tất cả');
  const [studentSearch, setStudentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadAnalytics = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const query = selectedCourseId
          ? `?courseId=${encodeURIComponent(selectedCourseId)}`
          : '';
        const response = await fetch(`http://localhost:5000/api/teacher/dashboard${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json() as ApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải dữ liệu Analytics.');
        }
        setDashboard(payload.data);
        setCourses(payload.courses || []);
        setError('');
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Lỗi tải Analytics giảng viên:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu Analytics.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadAnalytics();
    return () => controller.abort();
  }, [router, selectedCourseId, refreshKey]);

  const filteredStudents = (dashboard?.students || [])
    .filter((student) => filter === 'Tất cả' || student.status === filter)
    .filter((student) =>
      `${student.name} ${student.studentId || ''} ${student.weakTopics.join(' ')}`
        .toLowerCase()
        .includes(studentSearch.toLowerCase())
    );

  const refresh = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };

  const selectCourse = (courseId: string) => {
    setLoading(true);
    setDashboard(null);
    setSelectedCourseId(courseId);
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Giảng viên · Analytics</p>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích khóa học</h1>
          <p className="mt-1 text-sm text-gray-500">Số liệu học viên, tiến độ, kết quả và chủ đề cần củng cố.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {courses.length > 0 && (
            <label className="text-xs font-semibold text-gray-600">
              Khóa học
              <select
                value={selectedCourseId || String(dashboard?.courseId ?? '')}
                onChange={(event) => selectCourse(event.target.value)}
                className="mt-1 block min-w-52 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </header>

      {dashboard && (
        <p className="text-sm font-medium text-gray-600">
          {dashboard.courseName} · {dashboard.totalStudentsClass} học viên đang tham gia
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !dashboard ? (
        <div role="status" className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Đang tải dữ liệu Analytics...
        </div>
      ) : !dashboard ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center">
          <h2 className="font-semibold text-gray-900">Chưa có dữ liệu khóa học</h2>
          <p className="mt-2 text-sm text-gray-500">
            {error || 'Bạn chưa được phân công khóa học để xem thống kê.'}
          </p>
        </div>
      ) : (
        <>
          <section aria-label="Thống kê khóa học" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Học viên đang tham gia"
              value={dashboard.stats.totalStudents}
              detail={`${dashboard.pendingApprovals} yêu cầu ghi danh đang chờ`}
              icon={Users}
              tone="bg-blue-50 text-blue-600"
            />
            <MetricCard
              label="Hoạt động trong 7 ngày"
              value={dashboard.stats.activeStudents}
              detail="Học viên có hoạt động gần đây"
              icon={Activity}
              tone="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              label="Tiến độ hoàn thành trung bình"
              value={`${dashboard.stats.courseCompletion}%`}
              detail={`${dashboard.stats.completedStudents} học viên hoàn thành`}
              icon={RefreshCw}
              tone="bg-indigo-50 text-indigo-600"
            />
            <MetricCard
              label="Điểm trung bình bài đã chấm"
              value={dashboard.stats.avgScore === null ? '—' : `${dashboard.stats.avgScore}%`}
              detail="Theo các lượt làm đã chấm"
              icon={Award}
              tone="bg-amber-50 text-amber-600"
            />
          </section>

          <section aria-label="Tiến độ và kết quả" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900">Tình trạng hoàn thành khóa học</h2>
              <div className="mt-5 space-y-4">
                <ProgressRow label="Hoàn thành" value={dashboard.stats.completedStudents} total={dashboard.stats.totalStudents} tone="bg-emerald-500" />
                <ProgressRow label="Đang học" value={dashboard.stats.inProgressStudents} total={dashboard.stats.totalStudents} tone="bg-blue-500" />
                <ProgressRow label="Chưa bắt đầu" value={dashboard.stats.notStartedStudents} total={dashboard.stats.totalStudents} tone="bg-gray-300" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900">Phân bố điểm các lượt đã chấm</h2>
              <div className="mt-5 space-y-3">
                {dashboard.gradeDistribution.map((item) => (
                  <div key={item.range} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3 text-xs">
                    <span className="text-gray-500">{item.range}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: item.height }} />
                    </div>
                    <span className="text-right font-semibold text-gray-700">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900">Chủ đề có mức độ nắm vững thấp</h2>
            {dashboard.hardTopics.length ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {dashboard.hardTopics.map((topic) => (
                  <div key={topic.name} className="rounded-lg border border-gray-100 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-gray-700">{topic.name}</span>
                      <span className={`font-bold ${topic.text}`}>{topic.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${topic.color}`} style={{ width: `${topic.percent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Mức độ nắm vững trung bình</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                Chưa có chủ đề nào được ghi nhận ở mức nắm vững thấp.
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Danh sách học viên theo dõi</h2>
                <p className="mt-1 text-xs text-gray-500">{filteredStudents.length} học viên theo bộ lọc hiện tại</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  type="search"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Tìm tên, MSSV, chủ đề yếu..."
                  aria-label="Tìm học viên"
                  className="min-w-60 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <div className="flex rounded-lg border border-gray-100 bg-gray-50 p-1">
                  {studentFilters.map((studentFilter) => (
                    <button
                      key={studentFilter}
                      type="button"
                      onClick={() => setFilter(studentFilter)}
                      aria-pressed={filter === studentFilter}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                        filter === studentFilter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {studentFilter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredStudents.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead>
                    <tr className="border-b border-gray-50 text-xs font-bold uppercase tracking-wide text-gray-400">
                      <th className="px-5 py-3">Học viên</th>
                      <th className="px-5 py-3">Tiến độ</th>
                      <th className="px-5 py-3">Điểm trung bình</th>
                      <th className="px-5 py-3">Chủ đề yếu</th>
                      <th className="px-5 py-3">Hoạt động cuối</th>
                      <th className="px-5 py-3">Trạng thái</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <span className="font-medium text-gray-800">{student.name}</span>
                          {student.studentId && <span className="mt-1 block text-xs text-gray-500">{student.studentId}</span>}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{student.progress}%</td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {student.avgScore === null ? '—' : `${student.avgScore}%`}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {student.weakTopics.length ? student.weakTopics.join(', ') : 'Không có'}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{student.lastActive}</td>
                        <td className="px-5 py-4 text-xs font-medium text-gray-600">{student.status}</td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/teacher/dashboard/students/${dashboard.courseId}/${student.id}`}
                            className="whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Chi tiết
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-gray-500">
                {dashboard.students.length ? 'Không có học viên phù hợp với bộ lọc.' : 'Khóa học chưa có học viên đang tham gia.'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
    </section>
  );
}

function ProgressRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{value} · {percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
