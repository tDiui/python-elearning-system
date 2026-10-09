"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpenCheck, RefreshCw } from 'lucide-react';

interface QuizItem {
  id: number;
  title: string;
  courseName: string;
  chapterName: string;
  tags: string[];
  questionCount: number;
  timeLimit: number;
  passScore: number | null;
  maxScore: number;
  attemptCount: number;
}

export default function StudentQuizPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/student/quizzes', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Không thể tải danh sách bài kiểm tra.');
        }

        setQuizzes(result.data);
      } catch (fetchError) {
        console.error('Lỗi tải danh sách bài kiểm tra:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách bài kiểm tra.');
      } finally {
        setLoading(false);
      }
    };

    void fetchQuizzes();
  }, [router]);

  const courseNames = Array.from(new Set(quizzes.map((quiz) => quiz.courseName).filter(Boolean)));
  const headingCourse = courseNames.length === 1 ? courseNames[0] : 'Bài kiểm tra theo khóa học';

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        <span className="flex items-center gap-2 font-medium"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải bài kiểm tra...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{headingCourse}</p>
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-gray-900">Bài kiểm tra của bạn</h1>
        <p className="max-w-2xl text-sm leading-6 text-gray-500">
          Nội dung được lấy từ các bài kiểm tra đã publish trong những khóa học bạn đã được duyệt tham gia.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          <RefreshCw className="h-4 w-4" />
          Đã đồng bộ · {quizzes.length} quiz
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
          <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-gray-300" />
          <h2 className="mb-2 text-lg font-bold text-gray-800">Chưa có bài kiểm tra được publish</h2>
          <p className="mx-auto max-w-lg text-sm leading-6 text-gray-500">
            Các bài kiểm tra sẽ xuất hiện ở đây khi giảng viên publish quiz thuộc khóa học bạn đã được duyệt tham gia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {quizzes.map((quiz, index) => (
            <article key={quiz.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <BookOpenCheck className="h-5 w-5" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Đã publish</span>
                    {quiz.chapterName && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{quiz.chapterName}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-gray-400">Q{index + 1}</span>
              </div>

              {quiz.courseName && <p className="mb-1 text-xs font-medium text-gray-500">{quiz.courseName}</p>}
              <h2 className="mb-4 text-lg font-bold text-gray-900">{quiz.title}</h2>

              <div className="mb-5 flex min-h-7 flex-wrap gap-2">
                {quiz.tags.map((tag, tagIndex) => (
                  <span key={`${tag}-${tagIndex}`} className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">{tag}</span>
                ))}
              </div>

              <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-2 sm:gap-3 sm:p-3">
                <div className="rounded-lg bg-white px-2 py-3 text-center">
                  <p className="text-base font-extrabold text-gray-900">{quiz.questionCount}</p>
                  <p className="text-xs text-gray-500">Câu hỏi</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-3 text-center">
                  <p className="text-base font-extrabold text-gray-900">{quiz.timeLimit} phút</p>
                  <p className="text-xs text-gray-500">Thời gian</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-3 text-center">
                  <p className="text-base font-extrabold text-gray-900">{quiz.passScore === null ? '—' : `${quiz.passScore}%`}</p>
                  <p className="text-xs text-gray-500">Điểm đạt</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-gray-500">
                  {quiz.maxScore} điểm · {quiz.attemptCount} lượt làm
                </p>
                {quiz.questionCount > 0 ? (
                  <Link
                    href={`/student/quiz/${quiz.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Bắt đầu <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-amber-700">Quiz chưa có câu hỏi</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
