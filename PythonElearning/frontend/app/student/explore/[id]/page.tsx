"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type CourseDetails = {
  id: number;
  title: string;
  description: string;
  instructor: string;
  category: string;
  chapters: Array<{
    id: number;
    title: string;
    lessons: Array<{ id: number; title: string; durationMinutes: number }>;
  }>;
};

type EnrollmentStatus = 'Pending' | 'Active' | string | null;

export default function ExploreCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>(null);
  const [hasCheckedEnrollment, setHasCheckedEnrollment] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const totalLessons = course?.chapters.reduce((count, chapter) => count + chapter.lessons.length, 0) || 0;
  const firstLessonId = course?.chapters.flatMap(chapter => chapter.lessons)[0]?.id;

  useEffect(() => {
    let active = true;
    const fetchCourse = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/student/explore/${id}`);
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải thông tin khóa học.');
        }
        if (!active) return;
        setCourse(payload.data);

        const token = localStorage.getItem('token');
        if (token) {
          setIsAuthenticated(true);
          const enrollmentResponse = await fetch(`http://localhost:5000/api/student/explore/${id}/enrollment`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const enrollmentPayload = await enrollmentResponse.json();
          if (!enrollmentResponse.ok || !enrollmentPayload.success) {
            throw new Error(enrollmentPayload.message || 'Không thể kiểm tra trạng thái ghi danh.');
          }
          if (active) setEnrollmentStatus(enrollmentPayload.data.status);
        }
        if (active) setHasCheckedEnrollment(true);
      } catch (requestError) {
        console.error('Lỗi tải chi tiết khóa học:', requestError);
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải thông tin khóa học.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchCourse();
    return () => { active = false; };
  }, [id]);

  const requestEnrollment = async () => {
    const returnUrl = `/student/explore/${id}`;
    const token = localStorage.getItem('token');
    if (!token) {
      sessionStorage.setItem('enrollment-return-url', returnUrl);
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (!course || !window.confirm(`Bạn muốn gửi yêu cầu đăng ký khóa học "${course.title}"?`)) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/student/enroll', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId: course.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gửi yêu cầu đăng ký.');
      }
      setEnrollmentStatus(payload.data?.status || 'Pending');
    } catch (requestError) {
      console.error('Lỗi đăng ký khóa học:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi yêu cầu đăng ký.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-24 text-center text-gray-500">Đang tải thông tin khóa học...</div>;
  if (error && !course) {
    return <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  }
  if (!course) return <div className="py-24 text-center text-gray-500">Không tìm thấy khóa học đang mở.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/student/explore" className="inline-flex text-sm font-semibold text-blue-600 hover:underline">
        ← Quay lại danh sách khóa học
      </Link>

      <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-600">{course.category}</p>
        <h1 className="mb-3 text-3xl font-extrabold text-gray-900">{course.title}</h1>
        <p className="mb-6 text-sm text-gray-500">Giảng viên: <span className="font-semibold text-gray-800">{course.instructor}</span></p>
        <p className="whitespace-pre-line text-sm leading-7 text-gray-700">{course.description || 'Chưa có mô tả cho khóa học này.'}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-6">
          <span className="text-sm text-gray-600">{course.chapters.length} chương · {totalLessons} bài học</span>
          {enrollmentStatus === 'Active' ? (
            <button
              type="button"
              onClick={() => firstLessonId && router.push(`/student/lesson/${firstLessonId}`)}
              disabled={!firstLessonId}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Vào học
            </button>
          ) : enrollmentStatus === 'Pending' ? (
            <span className="rounded-lg bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800">Đang chờ giảng viên duyệt</span>
          ) : hasCheckedEnrollment && enrollmentStatus === null && isAuthenticated ? (
            <button
              type="button"
              onClick={() => void requestEnrollment()}
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu đăng ký'}
            </button>
          ) : enrollmentStatus ? (
            <span className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700">
              Trạng thái ghi danh: {enrollmentStatus}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void requestEnrollment()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Đăng nhập để đăng ký
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h2 className="mb-5 text-xl font-bold text-gray-900">Chương trình học</h2>
        {course.chapters.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có chương học được cập nhật.</p>
        ) : (
          <div className="space-y-4">
            {course.chapters.map((chapter, index) => (
              <details key={chapter.id} open={index === 0} className="rounded-xl border border-gray-200">
                <summary className="cursor-pointer px-5 py-4 font-semibold text-gray-800">
                  {chapter.title}<span className="ml-2 text-sm font-normal text-gray-500">({chapter.lessons.length} bài)</span>
                </summary>
                <ul className="space-y-2 border-t border-gray-100 px-5 py-4">
                  {chapter.lessons.map(lesson => (
                    <li key={lesson.id} className="flex items-center justify-between gap-4 text-sm text-gray-600">
                      <span>{lesson.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {lesson.durationMinutes > 0 ? `${lesson.durationMinutes} phút` : 'Chưa đặt thời lượng'}
                      </span>
                    </li>
                  ))}
                  {chapter.lessons.length === 0 && <li className="text-sm text-gray-400">Chưa có bài học trong chương này.</li>}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
