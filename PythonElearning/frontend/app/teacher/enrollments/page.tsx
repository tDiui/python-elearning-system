"use client";

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import Link from 'next/link';

interface Enrollment {
  id: number;
  studentUserId: number;
  studentName: string;
  email: string;
  studentId: string;
  courseId: number;
  courseTitle: string;
  status: string;
  enrollmentDate: string;
}

type Course = { id: number; title: string };

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Pending' | 'Active' | 'Rejected' | 'Removed' | 'All'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [actionError, setActionError] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const query = selectedCourseId ? `?courseId=${selectedCourseId}` : '';
      const res = await fetch(`http://localhost:5000/api/teacher/enrollments${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể tải danh sách học viên.');
      setEnrollments(data.data);
      setCourses(data.courses || []);
      setActionError('');
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Không thể tải danh sách học viên.');
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchEnrollments(); }, [fetchEnrollments]);

  const handleUpdateStatus = async (id: number, newStatus: 'Active' | 'Rejected') => {
    if (!window.confirm(`Bạn muốn ${newStatus === 'Active' ? 'DUYỆT' : 'TỪ CHỐI'} đơn đăng ký này?`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/teacher/enrollments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể cập nhật trạng thái ghi danh.');
      setEnrollments(prev => prev.map(en => en.id === id ? { ...en, status: newStatus } : en));
      setActionError('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái.');
    }
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId || !newStudentId.trim()) return;
    setAddingStudent(true);
    setActionError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/teacher/courses/${selectedCourseId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ studentId: newStudentId.trim() })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể thêm học viên.');
      setNewStudentId('');
      await fetchEnrollments();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể thêm học viên.');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (enrollment: Enrollment) => {
    if (!window.confirm(`Thu hồi quyền truy cập của ${enrollment.studentName}? Lịch sử ghi danh và tiến độ học tập vẫn được giữ lại.`)) return;
    setActionError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/teacher/enrollments/${enrollment.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể thu hồi quyền truy cập.');
      setEnrollments((current) => current.map((item) => item.id === enrollment.id ? { ...item, status: 'Removed' } : item));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể thu hồi quyền truy cập.');
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Tính toán thống kê
  const pendingCount = enrollments.filter(e => e.status === 'Pending').length;
  const approvedCount = enrollments.filter(e => e.status === 'Active').length;
  const rejectedCount = enrollments.filter(e => e.status === 'Rejected').length;
  const removedCount = enrollments.filter(e => e.status === 'Removed').length;

  // Lọc dữ liệu theo Tab và Search
  const filteredEnrollments = enrollments.filter(e => {
    const matchesTab = activeTab === 'All' || e.status === activeTab;
    const query = searchQuery.toLowerCase();
    const matchesSearch = e.studentName.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query) ||
      e.studentId.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });

  if (loading) return <div className="p-8 text-gray-500 font-medium">Đang tải dữ liệu đăng ký...</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Quản lý đăng ký</h1>
            <p className="text-sm text-gray-500 mt-1">Học viên theo khóa học • {enrollments.length} ghi danh</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 shadow-sm">
              Export
            </button>
            <Link href="/teacher/dashboard">
              <button className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                ← Về Dashboard
              </button>
            </Link>
          </div>
        </div>

        <form onSubmit={handleAddStudent} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-5">
          <label className="min-w-[220px] flex-1 text-sm font-semibold text-gray-700">
            Khóa học
            <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
              <option value="">Tất cả khóa học</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-sm font-semibold text-gray-700">
            Mã số sinh viên
            <input value={newStudentId} onChange={(event) => setNewStudentId(event.target.value)} placeholder="Nhập MSSV" className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" disabled={!selectedCourseId || !newStudentId.trim() || addingStudent} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {addingStudent ? 'Đang thêm...' : 'Thêm học viên'}
          </button>
        </form>

        {actionError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

        {/* Thẻ thống kê */}
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
          <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl">
            <div className="text-2xl mb-2">⏳</div>
            <div className="text-3xl font-extrabold text-amber-600 mb-1">{pendingCount}</div>
            <div className="text-sm font-medium text-amber-700">Chờ duyệt</div>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-3xl font-extrabold text-emerald-600 mb-1">{approvedCount}</div>
            <div className="text-sm font-medium text-emerald-700">Đã duyệt</div>
          </div>
          <div className="bg-red-50/50 border border-red-100 p-5 rounded-2xl">
            <div className="text-2xl mb-2">❌</div>
            <div className="text-3xl font-extrabold text-red-600 mb-1">{rejectedCount}</div>
            <div className="text-sm font-medium text-red-700">Từ chối</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl">
            <div className="text-2xl mb-2">↩️</div>
            <div className="text-3xl font-extrabold text-gray-600 mb-1">{removedCount}</div>
            <div className="text-sm font-medium text-gray-700">Đã thu hồi quyền</div>
          </div>
        </div>

        {/* Thanh Filter & Search */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex bg-gray-100/70 p-1 rounded-xl">
            <button onClick={() => setActiveTab('Pending')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Chờ duyệt <span className="ml-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{pendingCount}</span>
            </button>
            <button onClick={() => setActiveTab('Active')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Đã duyệt <span className="ml-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{approvedCount}</span>
            </button>
            <button onClick={() => setActiveTab('Rejected')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Rejected' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Từ chối <span className="ml-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{rejectedCount}</span>
            </button>
            <button onClick={() => setActiveTab('Removed')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Removed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Đã thu hồi <span className="ml-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{removedCount}</span>
            </button>
            <button onClick={() => setActiveTab('All')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'All' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Tất cả <span className="ml-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{enrollments.length}</span>
            </button>
          </div>
          <div className="relative w-80">
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Tìm theo tên, email, MSSV..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Danh sách Đơn đăng ký */}
        <div className="space-y-4">
          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-medium bg-white rounded-2xl border border-gray-100">
              Không có đơn đăng ký nào phù hợp.
            </div>
          ) : (
            filteredEnrollments.map((en) => (
              <div key={en.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-shadow">
                
                {/* Info */}
                <div className="flex items-center gap-4 w-1/3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {getInitials(en.studentName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-gray-900">{en.studentName}</h3>
                      <span className="text-xs text-gray-400">• {en.studentId}</span>
                    </div>
                    <p className="text-xs font-semibold text-blue-600 mb-1 line-clamp-1">{en.courseTitle}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      🕒 {new Date(en.enrollmentDate).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Enrollment actions */}
                <div className="flex items-center gap-3 justify-end border-l border-gray-100 pl-4">
                  <div className="flex gap-2">
                    {en.status === 'Pending' && (
                      <>
                        <button onClick={() => handleUpdateStatus(en.id, 'Active')} className="w-9 h-9 rounded-lg border border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors font-bold text-lg">
                          ✓
                        </button>
                        <button onClick={() => handleUpdateStatus(en.id, 'Rejected')} className="w-9 h-9 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors font-bold text-lg">
                          ✕
                        </button>
                      </>
                    )}
                    {en.status === 'Active' && (
                      <>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">Đang hoạt động</span>
                        <button onClick={() => void handleRemoveStudent(en)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Thu hồi</button>
                      </>
                    )}
                    {en.status === 'Rejected' && <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">Đã từ chối</span>}
                    {en.status === 'Removed' && <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">Đã thu hồi</span>}
                    
                    {['Active', 'Removed'].includes(en.status) && (
                      <Link href={`/teacher/dashboard/students/${en.courseId}/${en.studentUserId}`} aria-label={`Xem tiến độ của ${en.studentName}`} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-center transition-colors font-bold">
                        ›
                      </Link>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}