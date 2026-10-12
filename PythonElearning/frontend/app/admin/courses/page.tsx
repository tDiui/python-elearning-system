"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import {
  BookOpen,
  Check,
  Clock3,
  GraduationCap,
  LockKeyhole,
  LockKeyholeOpen,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/Input';

type Category = { id: number; name: string; description: string | null; courseCount: number };
type Instructor = { id: number; fullName: string; email: string };
type CourseStatus = 'Draft' | 'Pending' | 'Published' | 'Archived';
type Course = {
  id: number;
  title: string;
  description: string | null;
  status: CourseStatus;
  createdAt: string;
  category: { id: number; name: string };
  instructor: Instructor;
  chapterCount: number;
  studentCount: number;
  completedStudentCount: number;
};
type ManagementData = {
  courses: Course[];
  categories: Category[];
  instructors: Instructor[];
  stats: { totalCourses: number; publishedCourses: number; pendingCourses: number; activeEnrollments: number };
  statusCounts: Record<'all' | CourseStatus, number>;
};
type ApiResponse<T> = { success: boolean; message?: string; data: T };
type CourseForm = { title: string; description: string; categoryId: string; instructorId: string; status: CourseStatus };
type CategoryForm = { name: string; description: string };

const courseStatuses: CourseStatus[] = ['Published', 'Pending', 'Draft', 'Archived'];
const courseStatusLabels: Record<CourseStatus, string> = {
  Published: 'Đã xuất bản',
  Pending: 'Chờ duyệt',
  Draft: 'Bản nháp',
  Archived: 'Đã lưu trữ'
};

const subscribeToUser = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};
const getTokenSnapshot = () => localStorage.getItem('token') || '';

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const response = await fetch(`http://localhost:5000/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
  const result = await response.json() as ApiResponse<T>;
  if (!response.ok || !result.success) throw new Error(result.message || 'Không thể hoàn tất yêu cầu.');
  return result;
}

function statusStyle(status: CourseStatus) {
  if (status === 'Published') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Pending') return 'bg-amber-50 text-amber-700';
  if (status === 'Archived') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-50 text-blue-700';
}

export default function AdminCoursesPage() {
  const token = useSyncExternalStore(subscribeToUser, getTokenSnapshot, () => '');
  const [data, setData] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'courses' | 'categories'>('courses');
  const [statusFilter, setStatusFilter] = useState<'all' | CourseStatus>('all');
  const [search, setSearch] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'course' | 'category' | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>({
    title: '', description: '', categoryId: '', instructorId: '', status: 'Draft'
  });
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    let ignoreResult = false;
    adminRequest<ManagementData>('/courses')
      .then((result) => {
        if (ignoreResult) return;
        setData(result.data);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (ignoreResult) return;
        const message = loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu khóa học.';
        setError(message);
        setLoading(false);
        if (message.includes('đăng nhập lại')) window.location.replace('/login');
      });
    return () => {
      ignoreResult = true;
    };
  }, [refreshKey, token]);

  const visibleCourses = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLocaleLowerCase();
    return data.courses.filter((course) => {
      const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
      const matchesInstructor = instructorFilter === 'all' || String(course.instructor.id) === instructorFilter;
      const matchesSearch = !query || [
        course.title,
        course.description || '',
        course.category.name,
        course.instructor.fullName,
        course.instructor.email
      ].some((value) => value.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesInstructor && matchesSearch;
    });
  }, [data, statusFilter, instructorFilter, search]);

  function openCreateCourse() {
    setEditingCourse(null);
    setCourseForm({
      title: '',
      description: '',
      categoryId: data?.categories[0] ? String(data.categories[0].id) : '',
      instructorId: data?.instructors[0] ? String(data.instructors[0].id) : '',
      status: 'Draft'
    });
    setError('');
    setModal('course');
  }

  function openEditCourse(course: Course) {
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || '',
      categoryId: String(course.category.id),
      instructorId: String(course.instructor.id),
      status: course.status
    });
    setError('');
    setModal('course');
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setError('');
    setModal('category');
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, description: category.description || '' });
    setError('');
    setModal('category');
  }

  async function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await adminRequest<{ id?: number }>(
        editingCourse ? `/courses/${editingCourse.id}` : '/courses',
        {
          method: editingCourse ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: courseForm.title,
            description: courseForm.description,
            categoryId: Number(courseForm.categoryId),
            instructorId: Number(courseForm.instructorId),
            status: courseForm.status
          })
        }
      );
      setNotice(result.message || (editingCourse ? 'Đã cập nhật khóa học.' : 'Đã tạo khóa học.'));
      setModal(null);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu khóa học.');
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await adminRequest<Category>(
        editingCategory ? `/categories/${editingCategory.id}` : '/categories',
        {
          method: editingCategory ? 'PUT' : 'POST',
          body: JSON.stringify(categoryForm)
        }
      );
      setNotice(result.message || (editingCategory ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.'));
      setModal(null);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu danh mục.');
    } finally {
      setSaving(false);
    }
  }

  async function changeCourseStatus(course: Course, status: CourseStatus) {
    const action = status === 'Published' ? 'xuất bản' : status === 'Draft' ? 'đưa về bản nháp' : 'cập nhật trạng thái';
    if (!window.confirm(`Bạn có chắc muốn ${action} khóa học "${course.title}" không?`)) return;
    setActionId(course.id);
    setError('');
    try {
      const result = await adminRequest<{ id: number; status: CourseStatus }>(`/courses/${course.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setNotice(result.message || 'Đã cập nhật trạng thái khóa học.');
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không thể cập nhật trạng thái khóa học.');
    } finally {
      setActionId(null);
    }
  }

  async function toggleCourseLock(course: Course) {
    const isLocked = course.status !== 'Archived';
    const action = isLocked ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} khóa học "${course.title}" không?${isLocked ? '' : ' Khóa học sẽ trở về trạng thái Draft.'}`)) return;
    setActionId(course.id);
    setError('');
    try {
      const result = await adminRequest<{ id: number; status: CourseStatus }>(`/courses/${course.id}/lock`, {
        method: 'PATCH',
        body: JSON.stringify({ isLocked })
      });
      setNotice(result.message || `Đã ${action} khóa học.`);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không thể thay đổi trạng thái khóa học.');
    } finally {
      setActionId(null);
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Xóa khóa học "${course.title}"? Thao tác này không thể hoàn tác.`)) return;
    setActionId(course.id);
    setError('');
    try {
      const result = await adminRequest<null>(`/courses/${course.id}`, { method: 'DELETE' });
      setNotice(result.message || 'Đã xóa khóa học.');
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa khóa học.');
    } finally {
      setActionId(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Xóa danh mục "${category.name}"? Thao tác này không thể hoàn tác.`)) return;
    setActionId(category.id);
    setError('');
    try {
      const result = await adminRequest<null>(`/categories/${category.id}`, { method: 'DELETE' });
      setNotice(result.message || 'Đã xóa danh mục.');
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa danh mục.');
    } finally {
      setActionId(null);
    }
  }

  const courseFormReady = Boolean(data?.categories.length && data?.instructors.length);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Admin&nbsp; › &nbsp;Courses</p>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý khóa học</h1>
          <p className="mt-1 text-sm text-gray-500">Kiểm duyệt nội dung và quản lý khóa học, danh mục.</p>
        </div>
        <button
          type="button"
          onClick={activeTab === 'courses' ? openCreateCourse : openCreateCategory}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          {activeTab === 'courses' ? 'Tạo khóa học' : 'Thêm danh mục'}
        </button>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={16} /></button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Đóng thông báo lỗi"><X size={16} /></button>
        </div>
      )}

      <section aria-label="Thống kê khóa học" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BookOpen size={20} /></span>
          <div><p className="text-2xl font-bold text-gray-900">{data?.stats.totalCourses ?? 0}</p><p className="text-xs text-gray-500">Tổng khóa học</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Check size={20} /></span>
          <div><p className="text-2xl font-bold text-gray-900">{data?.stats.publishedCourses ?? 0}</p><p className="text-xs text-gray-500">Đang hoạt động</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock3 size={20} /></span>
          <div><p className="text-2xl font-bold text-gray-900">{data?.stats.pendingCourses ?? 0}</p><p className="text-xs text-gray-500">Chờ kiểm duyệt</p></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><GraduationCap size={21} /></span>
          <div><p className="text-2xl font-bold text-gray-900">{data?.stats.activeEnrollments.toLocaleString('vi-VN') ?? 0}</p><p className="text-xs text-gray-500">Lượt học đang hoạt động</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex border-b border-gray-100 px-5">
          <button type="button" onClick={() => setActiveTab('courses')} className={`border-b-2 px-4 py-3.5 text-sm font-semibold ${activeTab === 'courses' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            Khóa học
          </button>
          <button type="button" onClick={() => setActiveTab('categories')} className={`border-b-2 px-4 py-3.5 text-sm font-semibold ${activeTab === 'categories' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            Danh mục ({data?.categories.length ?? 0})
          </button>
        </div>

        {activeTab === 'courses' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 xl:flex-row xl:items-center">
              <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
                {(['all', ...courseStatuses] as const).map((status) => {
                  const label = status === 'all' ? 'Tất cả' : status;
                  const count = data?.statusCounts[status] ?? 0;
                  return (
                    <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${statusFilter === status ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                      {label} <span className="ml-1 text-gray-400">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input aria-label="Tìm khóa học" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khóa học, danh mục, giảng viên..." className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
              </div>
              <select aria-label="Lọc theo giảng viên" value={instructorFilter} onChange={(event) => setInstructorFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                <option value="all">Tất cả giảng viên</option>
                {data?.instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.fullName}</option>)}
              </select>
            </div>
            {loading ? (
              <div className="p-12 text-center text-sm font-medium text-gray-500">Đang tải khóa học...</div>
            ) : visibleCourses.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">{data?.courses.length ? 'Không tìm thấy khóa học phù hợp.' : 'Chưa có khóa học nào trong hệ thống.'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Khóa học</th>
                      <th className="px-4 py-3.5 font-semibold">Danh mục</th>
                      <th className="px-4 py-3.5 font-semibold">Giảng viên</th>
                      <th className="px-4 py-3.5 font-semibold">Học viên</th>
                      <th className="px-4 py-3.5 font-semibold">Hoàn thành</th>
                      <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
                      <th className="px-4 py-3.5 font-semibold">Ngày tạo</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleCourses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <p className="max-w-[250px] truncate font-semibold text-gray-900" title={course.title}>{course.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{course.chapterCount} chương</p>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{course.category.name}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-700">{course.instructor.fullName}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{course.instructor.email}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-gray-700">{course.studentCount.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-4 font-semibold text-gray-700">{course.completedStudentCount.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-4">
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(course.status)}`}>{courseStatusLabels[course.status]}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-500">{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(course.createdAt))}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            {course.status === 'Pending' && (
                              <>
                                <button type="button" disabled={actionId === course.id} onClick={() => void changeCourseStatus(course, 'Published')} title="Duyệt và xuất bản" aria-label={`Duyệt ${course.title}`} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Check size={16} /></button>
                                <button type="button" disabled={actionId === course.id} onClick={() => void changeCourseStatus(course, 'Draft')} title="Từ chối và chuyển về Draft" aria-label={`Từ chối ${course.title}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Từ chối</button>
                              </>
                            )}
                            <button type="button" onClick={() => openEditCourse(course)} title="Chỉnh sửa khóa học" aria-label={`Chỉnh sửa ${course.title}`} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16} /></button>
                            <button type="button" disabled={actionId === course.id} onClick={() => void toggleCourseLock(course)} title={course.status === 'Archived' ? 'Mở khóa khóa học' : 'Khóa khóa học'} aria-label={`${course.status === 'Archived' ? 'Mở khóa' : 'Khóa'} ${course.title}`} className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50">
                              {course.status === 'Archived' ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={16} />}
                            </button>
                            <button type="button" disabled={actionId === course.id} onClick={() => void deleteCourse(course)} title="Xóa khóa học" aria-label={`Xóa ${course.title}`} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Hiển thị {visibleCourses.length} / {data?.courses.length ?? 0} khóa học</div>
          </>
        ) : (
          <>
            {loading ? (
              <div className="p-12 text-center text-sm font-medium text-gray-500">Đang tải danh mục...</div>
            ) : !data?.categories.length ? (
              <div className="p-12 text-center text-sm text-gray-500">Chưa có danh mục nào. Hãy thêm danh mục trước khi tạo khóa học.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Danh mục</th>
                      <th className="px-4 py-3.5 font-semibold">Mô tả</th>
                      <th className="px-4 py-3.5 font-semibold">Khóa học</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 font-semibold text-gray-900"><Tag size={16} className="text-blue-500" />{category.name}</span>
                        </td>
                        <td className="max-w-lg px-4 py-4 text-gray-600">{category.description || '—'}</td>
                        <td className="px-4 py-4 text-gray-700">{category.courseCount}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openEditCategory(category)} title="Chỉnh sửa danh mục" aria-label={`Chỉnh sửa ${category.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={16} /></button>
                            <button type="button" disabled={actionId === category.id || category.courseCount > 0} onClick={() => void deleteCategory(category)} title={category.courseCount ? 'Không thể xóa danh mục đang có khóa học' : 'Xóa danh mục'} aria-label={`Xóa ${category.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModal(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-course-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="admin-course-form-title" className="text-xl font-bold text-gray-900">
                  {modal === 'course'
                    ? editingCourse ? 'Chỉnh sửa khóa học' : 'Tạo khóa học'
                    : editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modal === 'course' ? 'Thông tin được lưu vào dữ liệu khóa học hiện có.' : 'Cập nhật tên và mô tả danh mục.'}
                </p>
              </div>
              <button type="button" disabled={saving} onClick={() => setModal(null)} aria-label="Đóng biểu mẫu" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
            </div>
            {modal === 'course' ? (
              <form onSubmit={submitCourse} className="flex flex-col gap-4">
                <Input label="Tên khóa học" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} maxLength={200} required />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Mô tả
                  <textarea value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} rows={3} className="resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Danh mục
                  <select required value={courseForm.categoryId} onChange={(event) => setCourseForm({ ...courseForm, categoryId: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                    <option value="" disabled>Chọn danh mục</option>
                    {data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Giảng viên phụ trách
                  <select required value={courseForm.instructorId} onChange={(event) => setCourseForm({ ...courseForm, instructorId: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                    <option value="" disabled>Chọn giảng viên</option>
                    {data?.instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.fullName} — {instructor.email}</option>)}
                  </select>
                </label>
                {editingCourse && (
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                    Trạng thái
                    <select value={courseForm.status} onChange={(event) => setCourseForm({ ...courseForm, status: event.target.value as CourseStatus })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                      {courseStatuses.map((status) => <option key={status} value={status}>{courseStatusLabels[status]}</option>)}
                    </select>
                  </label>
                )}
                {!courseFormReady && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Cần có ít nhất một danh mục và một giảng viên đang hoạt động để tạo khóa học.</p>}
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="mt-2 flex justify-end gap-3">
                  <button type="button" disabled={saving} onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Hủy</button>
                  <button type="submit" disabled={saving || !courseFormReady} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Đang lưu...' : editingCourse ? 'Lưu thay đổi' : 'Tạo khóa học'}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitCategory} className="flex flex-col gap-4">
                <Input label="Tên danh mục" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} maxLength={100} required />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Mô tả
                  <textarea value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} rows={4} className="resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
                </label>
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="mt-2 flex justify-end gap-3">
                  <button type="button" disabled={saving} onClick={() => setModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Hủy</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Đang lưu...' : editingCategory ? 'Lưu thay đổi' : 'Thêm danh mục'}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
