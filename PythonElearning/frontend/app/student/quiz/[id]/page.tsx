"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, Send } from 'lucide-react';

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  type: 'multipleChoice' | 'trueFalse' | 'fillIn';
  text: string;
  points: number;
  options: QuizOption[];
}

interface QuizDetail {
  id: number;
  title: string;
  courseName: string;
  chapterName: string;
  timeLimit: number;
  maxScore: number;
  passScore: number | null;
  questions: QuizQuestion[];
}

interface QuizResult {
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  maxScore: number;
  scoreEarned: number;
  passScore: number | null;
  passed: boolean;
}

export default function StudentQuizAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(`http://localhost:5000/api/student/quiz/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải bài kiểm tra.');
        }

        setQuiz(payload.data);
        if (payload.data.timeLimit > 0) {
          setSecondsLeft(payload.data.timeLimit * 60);
        }
      } catch (fetchError) {
        console.error('Lỗi tải bài kiểm tra:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải bài kiểm tra.');
      } finally {
        setLoading(false);
      }
    };

    void fetchQuiz();
  }, [id, router]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || result) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => current === null ? null : Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft, result]);

  const handleSubmit = async () => {
    if (!quiz || isSubmitting || result) return;
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/student/quiz/${quiz.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            value: answers[question.id] ?? null
          }))
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể nộp bài kiểm tra.');
      }

      setResult(payload.data);
    } catch (submitError) {
      console.error('Lỗi nộp bài kiểm tra:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Không thể nộp bài kiểm tra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-gray-500">Đang tải bài kiểm tra...</div>;
  }

  if (error && !quiz) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <Link href="/student/quiz" className="mt-4 inline-flex font-bold text-blue-700 hover:underline">Quay lại danh sách</Link>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <Link href="/student/quiz" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-600">
        <ArrowLeft className="h-4 w-4" /> Danh sách bài kiểm tra
      </Link>

      <header className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-700">
          {quiz.courseName && <span>{quiz.courseName}</span>}
          {quiz.courseName && quiz.chapterName && <span className="text-gray-300">/</span>}
          {quiz.chapterName && <span>{quiz.chapterName}</span>}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{quiz.title}</h1>
            <p className="mt-2 text-sm text-gray-500">{quiz.questions.length} câu hỏi · Tối đa {quiz.maxScore} điểm</p>
          </div>
          {secondsLeft !== null && (
            <div className={`inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-bold ${secondsLeft === 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              <Clock3 className="h-4 w-4" />
              {secondsLeft === 0 ? 'Hết giờ' : formatTime(secondsLeft)}
            </div>
          )}
        </div>
      </header>

      {result ? (
        <section aria-live="polite" className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className={`mx-auto mb-4 h-12 w-12 ${result.passed ? 'text-emerald-500' : 'text-amber-500'}`} />
          <h2 className="text-xl font-extrabold text-gray-900">{result.passed ? 'Bạn đã đạt bài kiểm tra' : 'Bài kiểm tra đã được ghi nhận'}</h2>
          <p className="mt-3 text-3xl font-extrabold text-blue-700">{result.percentage}%</p>
          <p className="mt-2 text-sm text-gray-500">
            {result.pointsEarned}/{result.totalPoints} điểm câu hỏi · {result.scoreEarned}/{result.maxScore} điểm bài kiểm tra
          </p>
          {result.passScore !== null && <p className="mt-1 text-xs text-gray-500">Điểm đạt: {result.passScore}%</p>}
          <button onClick={() => router.push('/student/quiz')} className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            Quay lại danh sách
          </button>
        </section>
      ) : quiz.questions.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Bài kiểm tra này chưa có câu hỏi. Vui lòng báo giảng viên kiểm tra nội dung quiz.
        </div>
      ) : (
        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <fieldset key={question.id} disabled={secondsLeft === 0 || isSubmitting} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <legend className="sr-only">Câu hỏi {index + 1}</legend>
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{index + 1}</span>
                <div className="flex-1">
                  <p className="whitespace-pre-wrap font-semibold leading-6 text-gray-900">{question.text}</p>
                  <p className="mt-1 text-xs text-gray-500">{question.points} điểm</p>
                </div>
              </div>

              {question.type === 'multipleChoice' ? (
                <div className="space-y-2 pl-11">
                  {question.options.map((option, optionIndex) => (
                    <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-blue-300 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span className="flex gap-2 text-sm leading-5 text-gray-700">
                        <span className="font-semibold text-gray-400">{String.fromCharCode(65 + optionIndex)}.</span>
                        {option.text}
                      </span>
                    </label>
                  ))}
                </div>
              ) : question.type === 'trueFalse' ? (
                <div className="flex gap-3 pl-11">
                  {[true, false].map((value) => (
                    <label key={String(value)} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 hover:border-blue-300 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={answers[question.id] === value}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: value }))}
                        className="accent-blue-600"
                      />
                      {value ? 'Đúng' : 'Sai'}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="pl-11">
                  <input
                    type="text"
                    value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                    placeholder="Nhập câu trả lời"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}
            </fieldset>
          ))}

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {secondsLeft === 0 && <p role="status" className="text-sm font-medium text-red-600">Đã hết thời gian. Hãy nộp bài để ghi nhận kết quả.</p>}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
