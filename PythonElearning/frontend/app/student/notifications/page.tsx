"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  FileCheck2,
  GraduationCap,
  RefreshCw
} from 'lucide-react';

type NotificationType = 'AI' | 'Quiz' | 'Lesson' | 'Exercise' | 'Course' | 'General' | null;
type NotificationFilter = 'All' | 'AI' | 'Lesson' | 'Exercise';

interface StudentNotification {
  NotificationID: number;
  Title: string;
  Message: string;
  IsRead: boolean;
  CreatedAt: string;
  NotificationType: NotificationType;
  ActionLabel: string | null;
  ActionUrl: string | null;
}

const filters: { id: NotificationFilter; label: string }[] = [
  { id: 'All', label: 'Tất cả' },
  { id: 'AI', label: 'AI Updates' },
  { id: 'Lesson', label: 'Bài học' },
  { id: 'Exercise', label: 'Bài tập' }
];

const notificationStyles: Record<Exclude<NotificationType, null>, {
  Icon: typeof Bell;
  iconStyle: string;
  badge: string;
}> = {
  AI: { Icon: Brain, iconStyle: 'bg-violet-100 text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  Quiz: { Icon: FileCheck2, iconStyle: 'bg-rose-100 text-rose-700', badge: 'bg-rose-100 text-rose-700' },
  Lesson: { Icon: BookOpen, iconStyle: 'bg-emerald-100 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  Exercise: { Icon: Code2, iconStyle: 'bg-cyan-100 text-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
  Course: { Icon: GraduationCap, iconStyle: 'bg-amber-100 text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  General: { Icon: Bell, iconStyle: 'bg-blue-100 text-blue-700', badge: 'bg-blue-100 text-blue-700' }
};

function getTimeLabel(dateString: string) {
  const createdAt = new Date(dateString);
  if (Number.isNaN(createdAt.getTime())) return 'Thời gian không xác định';

  const elapsedMs = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt);
}

function getFilterType(type: NotificationType): NotificationFilter {
  if (type === 'AI' || type === 'Lesson') return type;
  if (type === 'Quiz' || type === 'Exercise') return 'Exercise';
  return 'All';
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch('http://localhost:5000/api/student/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể tải thông báo.');
      setNotifications(payload.data);
    } catch (fetchError) {
      console.error('Lỗi tải thông báo học viên:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải thông báo.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.IsRead).length,
    [notifications]
  );
  const visibleNotifications = useMemo(
    () => filter === 'All'
      ? notifications
      : notifications.filter((notification) => getFilterType(notification.NotificationType) === filter),
    [filter, notifications]
  );

  const publishUnreadCount = (count: number) => {
    window.dispatchEvent(new CustomEvent('student-notifications-updated', {
      detail: { unreadCount: count }
    }));
  };

  const markAsRead = async (notificationId: number) => {
    if (markingId !== null || markingAll) return;
    setMarkingId(notificationId);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch(`http://localhost:5000/api/student/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể cập nhật thông báo.');
      setNotifications((current) => current.map((notification) => notification.NotificationID === notificationId
        ? { ...notification, IsRead: true }
        : notification));
      publishUnreadCount(notifications.filter((notification) =>
        notification.NotificationID !== notificationId && !notification.IsRead
      ).length);
    } catch (markError) {
      console.error('Lỗi đánh dấu thông báo đã đọc:', markError);
      setError(markError instanceof Error ? markError.message : 'Không thể cập nhật thông báo.');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || markingAll || markingId !== null) return;
    setMarkingAll(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch('http://localhost:5000/api/student/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể cập nhật thông báo.');
      setNotifications((current) => current.map((notification) => ({ ...notification, IsRead: true })));
      publishUnreadCount(0);
    } catch (markError) {
      console.error('Lỗi đánh dấu tất cả thông báo đã đọc:', markError);
      setError(markError instanceof Error ? markError.message : 'Không thể cập nhật thông báo.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Cập nhật từ giảng viên</p>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-gray-900">
            <Bell className="h-7 w-7 text-blue-600" /> Thông báo
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {unreadCount} thông báo chưa đọc
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={markingAll || markingId !== null}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              {markingAll ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void fetchNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div role="tablist" aria-label="Lọc thông báo" className="mb-5 flex flex-wrap gap-2">
        {filters.map((item) => {
          const count = item.id === 'All'
            ? unreadCount
            : notifications.filter((notification) =>
                !notification.IsRead && getFilterType(notification.NotificationType) === item.id
              ).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {item.label}{item.id === 'All' && count > 0 ? ` ${count}` : ''}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải thông báo...
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <h2 className="font-bold text-gray-900">{filter === 'All' ? 'Chưa có thông báo' : 'Không có thông báo trong mục này'}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {filter === 'All' ? 'Thông báo từ giảng viên sẽ xuất hiện tại đây.' : 'Hãy chọn mục khác để xem thêm thông báo.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => {
            const style = notificationStyles[notification.NotificationType || 'General'];
            const Icon = style.Icon;
            return (
              <article
                key={notification.NotificationID}
                className={`flex flex-col gap-4 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-start sm:p-5 ${
                  notification.IsRead ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50/50'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconStyle}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900">{notification.Title}</h2>
                    {!notification.IsRead && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>Mới</span>
                    )}
                    {!notification.IsRead && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Chưa đọc" />}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-600">{notification.Message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {notification.ActionLabel && notification.ActionUrl && (
                      <Link
                        href={notification.ActionUrl}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        {notification.ActionLabel} <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                    {!notification.IsRead && (
                      <button
                        type="button"
                        disabled={markingId !== null || markingAll}
                        onClick={() => void markAsRead(notification.NotificationID)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-700 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {markingId === notification.NotificationID ? 'Đang lưu...' : 'Đánh dấu đã đọc'}
                      </button>
                    )}
                  </div>
                </div>
                <time
                  dateTime={notification.CreatedAt}
                  title={new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.CreatedAt))}
                  className="shrink-0 text-xs text-gray-400 sm:pt-1"
                >
                  {getTimeLabel(notification.CreatedAt)}
                </time>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
