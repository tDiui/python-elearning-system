"use client";

import { useEffect, useState } from 'react';
import { Bell, CheckSquare, Send } from 'lucide-react';

interface Course {
  id: number;
  title: string;
  activeStudentCount: number;
}

interface Recipient {
  id: number;
  name: string;
  email: string;
  studentId: string | null;
}

const notificationTypes = [
  { value: 'General', label: 'Thông báo chung', actionLabel: '', actionUrl: '' },
  { value: 'Lesson', label: 'Bài học mới', actionLabel: 'Học ngay', actionUrl: '/student/learn' },
  { value: 'Quiz', label: 'Bài kiểm tra', actionLabel: 'Xem kết quả', actionUrl: '/student/analytics' },
  { value: 'Exercise', label: 'Bài tập', actionLabel: 'Làm bài tập', actionUrl: '/student/exercises' },
  { value: 'Course', label: 'Khóa học', actionLabel: 'Xem khóa học', actionUrl: '/student/courses' },
  { value: 'AI', label: 'AI Updates', actionLabel: 'Xem phân tích', actionUrl: '/student/analytics' }
] as const;

export default function TeacherNotificationsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sendToAll, setSendToAll] = useState(true);
  const [notificationType, setNotificationType] = useState<(typeof notificationTypes)[number]['value']>('General');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Vui lòng đăng nhập lại.');
        const response = await fetch('http://localhost:5000/api/teacher/notification-courses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể tải danh sách khóa học.');
        setCourses(payload.data);
      } catch (fetchError) {
        console.error('Lỗi tải khóa học gửi thông báo:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách khóa học.');
      } finally {
        setLoadingCourses(false);
      }
    };
    void fetchCourses();
  }, []);

  useEffect(() => {
    if (!courseId) {
      return;
    }
    const fetchRecipients = async () => {
      setLoadingRecipients(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Vui lòng đăng nhập lại.');
        const response = await fetch(`http://localhost:5000/api/teacher/notification-courses/${courseId}/students`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể tải danh sách học viên.');
        setRecipients(payload.data);
        setSelectedIds([]);
      } catch (fetchError) {
        console.error('Lỗi tải học viên nhận thông báo:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách học viên.');
      } finally {
        setLoadingRecipients(false);
      }
    };
    void fetchRecipients();
  }, [courseId]);

  const selectedCourse = courses.find((course) => String(course.id) === courseId);
  const selectedType = notificationTypes.find((type) => type.value === notificationType) || notificationTypes[0];

  const sendNotification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setError('');
    setNotice('');
    if (!courseId) {
      setError('Vui lòng chọn khóa học.');
      return;
    }
    const recipientIds = sendToAll ? recipients.map((recipient) => recipient.id) : selectedIds;
    if (!recipientIds.length) {
      setError('Vui lòng chọn ít nhất một học viên đang hoạt động.');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch('http://localhost:5000/api/teacher/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId: Number(courseId),
          title,
          message,
          recipientIds,
          notificationType,
          ...(selectedType.actionLabel ? { actionLabel: selectedType.actionLabel, actionUrl: selectedType.actionUrl } : {})
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể gửi thông báo.');
      setNotice(payload.message || `Đã gửi thông báo đến ${recipientIds.length} học viên.`);
      setTitle('');
      setMessage('');
      setSelectedIds([]);
      setSendToAll(true);
    } catch (sendError) {
      console.error('Lỗi gửi thông báo:', sendError);
      setError(sendError instanceof Error ? sendError.message : 'Không thể gửi thông báo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Trao đổi với lớp học</p>
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-gray-900"><Bell className="h-7 w-7 text-blue-600" /> Gửi thông báo</h1>
        <p className="mt-2 text-sm text-gray-500">Thông báo được gửi trong hệ thống đến học viên có trạng thái đăng ký Active.</p>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

      <form onSubmit={sendNotification} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <label className="block text-sm font-bold text-gray-700">
          Khóa học
          <select
            required
            value={courseId}
            onChange={(event) => {
              setRecipients([]);
              setSelectedIds([]);
              setCourseId(event.target.value);
            }}
            disabled={loadingCourses}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{loadingCourses ? 'Đang tải khóa học...' : 'Chọn khóa học'}</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.activeStudentCount} học viên Active)</option>)}
          </select>
        </label>

        <fieldset disabled={!courseId || loadingRecipients} className="rounded-xl border border-gray-200 p-4">
          <legend className="px-2 text-sm font-bold text-gray-700">Người nhận</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
            <input type="radio" name="recipientMode" checked={sendToAll} onChange={() => setSendToAll(true)} className="accent-blue-600" />
            Tất cả học viên Active {selectedCourse ? `(${selectedCourse.activeStudentCount})` : ''}
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-gray-700">
            <input type="radio" name="recipientMode" checked={!sendToAll} onChange={() => setSendToAll(false)} className="accent-blue-600" />
            Chọn nhiều học viên cụ thể
          </label>
          {loadingRecipients ? (
            <p className="mt-4 text-xs text-gray-500">Đang tải danh sách học viên...</p>
          ) : recipients.length === 0 ? (
            <p className="mt-4 text-xs text-gray-500">{courseId ? 'Khóa học hiện chưa có học viên Active.' : 'Chọn khóa học để tải danh sách học viên.'}</p>
          ) : (
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto border-t border-gray-100 pt-3">
              {recipients.map((recipient) => (
                <label key={recipient.id} className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm ${sendToAll ? 'opacity-60' : 'hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(recipient.id)}
                    disabled={sendToAll}
                    onChange={(event) => setSelectedIds((current) => event.target.checked
                      ? [...current, recipient.id]
                      : current.filter((id) => id !== recipient.id))}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-800">{recipient.name}{recipient.studentId ? ` · ${recipient.studentId}` : ''}</span>
                    <span className="block truncate text-xs text-gray-500">{recipient.email}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {!sendToAll && selectedIds.length > 0 && <p className="mt-3 text-xs font-semibold text-blue-700">{selectedIds.length} học viên được chọn</p>}
        </fieldset>

        <label className="block text-sm font-bold text-gray-700">
          Tiêu đề
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block text-sm font-bold text-gray-700">
          Loại thông báo
          <select
            value={notificationType}
            onChange={(event) => setNotificationType(event.target.value as (typeof notificationTypes)[number]['value'])}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {notificationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          {selectedType.actionLabel && (
            <span className="mt-1 block text-xs font-normal text-gray-500">
              Tự thêm nút “{selectedType.actionLabel}” vào thông báo của sinh viên.
            </span>
          )}
        </label>

        <label className="block text-sm font-bold text-gray-700">
          Nội dung
          <textarea
            required
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="flex justify-end">
          <button type="submit" disabled={sending || loadingCourses || loadingRecipients} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {selectedIds.length > 0 && !sendToAll ? <CheckSquare className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sending ? 'Đang gửi...' : 'Gửi thông báo'}
          </button>
        </div>
      </form>
    </div>
  );
}
