"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type StudentProgress = {
  student: { id: number; name: string; email: string; studentId: string | null };
  course: { id: number; title: string };
  summary: {
    lessonCount: number;
    completedLessonCount: number;
    completionPercent: number;
    timeSpentSeconds: number;
    averageScore: number | null;
    lastActive: string | null;
  };
  lessons: Array<{ id: number; title: string; chapter: string; isCompleted: boolean }>;
  activities: Array<{
    id: string;
    actionType: string | null;
    lessonTitle: string | null;
    exerciseTitle: string | null;
    timeSpentSeconds: number;
    score: number | null;
    isCompleted: boolean | null;
    createdAt: string;
  }>;
  attempts: Array<{
    id: number;
    quizTitle: string;
    startedAt: string;
    submittedAt: string | null;
    totalScore: number;
    maxScore: number;
    scorePercent: number | null;
    gradingStatus: string;
    answers: Array<{ question: string; answer: string | boolean | null; score: number; isCorrect: boolean }>;
  }>;
};

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
};

export default function StudentProgressPage() {
  const params = useParams<{ courseId: string; studentId: string }>();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Phiên đăng nhập không hợp lệ.');
        const response = await fetch(
          `http://localhost:5000/api/teacher/courses/${params.courseId}/students/${params.studentId}/progress`,
          { headers: { Authorization: 'Bearer ' + token } }
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải tiến độ học viên.');
        }
        setProgress(payload.data);
      } catch (fetchError) {
        console.error('Lỗi tải tiến độ học viên:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải tiến độ học viên.');
      } finally {
        setLoading(false);
      }
    };
    void fetchProgress();
  }, [params.courseId, params.studentId]);

  if (loading) return <p className="p-8 text-sm text-gray-500">Đang tải tiến độ học tập...</p>;
  if (error || !progress) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || 'Không tìm thấy dữ liệu học viên.'}</p>
        <Link href="/teacher/dashboard" className="mt-4 inline-block text-sm font-semibold text-blue-700">← Về dashboard</Link>
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 pb-12">
      <Link href="/teacher/dashboard" className="w-fit text-sm font-semibold text-blue-700 hover:text-blue-900">← Về dashboard</Link>
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{progress.student.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {progress.student.studentId || 'Chưa có MSSV'} · {progress.student.email} · {progress.course.title}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-700">Hoàn thành bài học</p>
            <p className="mt-1 text-xl font-bold text-blue-900">{progress.summary.completionPercent}%</p>
            <p className="text-xs text-blue-700">{progress.summary.completedLessonCount}/{progress.summary.lessonCount} bài</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-indigo-700">Thời gian học</p>
            <p className="mt-1 text-xl font-bold text-indigo-900">{formatDuration(progress.summary.timeSpentSeconds)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-700">Điểm trung bình đã chấm</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{progress.summary.averageScore === null ? '—' : `${progress.summary.averageScore}%`}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-600">Hoạt động gần nhất</p>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {progress.summary.lastActive ? new Date(progress.summary.lastActive).toLocaleString('vi-VN') : 'Chưa có hoạt động'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Tiến độ từng bài học</h2>
        {progress.lessons.length ? (
          <ul className="divide-y divide-gray-100">
            {progress.lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{lesson.title}</p>
                  <p className="text-xs text-gray-500">{lesson.chapter}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lesson.isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {lesson.isCompleted ? 'Hoàn thành' : 'Chưa hoàn thành'}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Khóa học chưa có bài giảng đã xuất bản.</p>}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Lịch sử hoạt động học tập</h2>
        {progress.activities.length ? (
          <div className="space-y-3">
            {progress.activities.map((activity) => (
              <article key={activity.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">
                    {activity.lessonTitle || activity.exerciseTitle || activity.actionType || 'Hoạt động học'}
                  </p>
                  <time className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString('vi-VN')}</time>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Thời gian: {formatDuration(activity.timeSpentSeconds)}
                  {activity.score !== null && ` · Điểm: ${activity.score}`}
                  {activity.isCompleted !== null && ` · ${activity.isCompleted ? 'Hoàn thành' : 'Chưa hoàn thành'}`}
                </p>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">Chưa ghi nhận hoạt động học tập.</p>}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Các lượt làm bài kiểm tra</h2>
        {progress.attempts.length ? (
          <div className="space-y-4">
            {progress.attempts.map((attempt) => (
              <article key={attempt.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{attempt.quizTitle}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {attempt.submittedAt ? `Nộp lúc ${new Date(attempt.submittedAt).toLocaleString('vi-VN')}` : 'Chưa nộp'}
                      {' · '}{attempt.gradingStatus}
                    </p>
                  </div>
                  <p className="font-bold text-gray-800">
                    {attempt.scorePercent === null ? 'Chưa có điểm' : `${Math.round(attempt.scorePercent)}%`}
                    {attempt.scorePercent !== null && <span className="ml-1 text-xs font-normal text-gray-500">({attempt.totalScore}/{attempt.maxScore})</span>}
                  </p>
                </div>
                {attempt.answers.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-700">Xem câu trả lời</summary>
                    <ol className="mt-3 space-y-2">
                      {attempt.answers.map((answer, index) => (
                        <li key={`${attempt.id}-${index}`} className="rounded-lg bg-gray-50 p-3 text-xs">
                          <p className="font-semibold text-gray-800">{index + 1}. {answer.question}</p>
                          <p className="mt-1 text-gray-600">Trả lời: {answer.answer || 'Không có câu trả lời'} · {answer.score} điểm · {answer.isCorrect ? 'Đúng' : 'Chưa đúng'}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">Chưa có lượt làm bài kiểm tra.</p>}
      </section>
    </main>
  );
}
