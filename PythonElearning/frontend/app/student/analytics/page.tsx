"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle2, ClipboardList, Clock3, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface LearningResult {
  attemptId: number;
  title: string;
  type: string;
  courseName: string;
  chapterName: string;
  lessonName: string;
  startTime: string;
  endTime: string | null;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  passed: boolean | null;
  gradingStatus: string | null;
}

interface ResultData {
  summary: {
    attemptCount: number;
    averagePercentage: number;
    passedCount: number;
    passRate: number;
  };
  results: LearningResult[];
}

interface QuizQuestionDetail {
  question: string;
  type: string | null;
  points: number;
  scoreEarned: number;
  isCorrect: boolean;
  selectedAnswer: string | boolean | null;
  correctAnswers: string[];
  options: {
    content: string;
    isCorrect: boolean;
    isSelected: boolean;
  }[];
  explanation: string | null;
}

interface QuizAttemptDetail {
  attemptId: number;
  title: string;
  totalScore: number;
  instructorFeedback: string;
  questions: QuizQuestionDetail[];
}

export default function StudentAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailAttemptId, setDetailAttemptId] = useState<number | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<QuizAttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/student/results', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải kết quả học tập.');
        }

        setData(payload.data);
      } catch (fetchError) {
        console.error('Lỗi tải kết quả học tập:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải kết quả học tập.');
      } finally {
        setLoading(false);
      }
    };

    void fetchResults();
  }, [router]);

  const toggleAttemptDetail = async (attemptId: number) => {
    if (detailAttemptId === attemptId) {
      setDetailAttemptId(null);
      setAttemptDetail(null);
      setDetailError('');
      return;
    }

    setDetailAttemptId(attemptId);
    setAttemptDetail(null);
    setDetailError('');
    setDetailLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/student/results/${attemptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải chi tiết kết quả.');
      }

      setAttemptDetail(payload.data);
    } catch (fetchError) {
      console.error('Lỗi tải chi tiết kết quả quiz:', fetchError);
      setDetailError(fetchError instanceof Error ? fetchError.message : 'Không thể tải chi tiết kết quả.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        <span className="flex items-center gap-2 font-medium">
          <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải kết quả học tập...
        </span>
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  const summary = data?.summary;
  const results = data?.results || [];
  const summaryCards = [
    { label: 'Lượt làm bài', value: summary?.attemptCount ?? 0, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
    { label: 'Điểm trung bình', value: `${summary?.averagePercentage ?? 0}%`, icon: BarChart3, color: 'text-violet-600 bg-violet-50' },
    { label: 'Bài đạt', value: summary?.passedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Tỷ lệ đạt', value: `${summary?.passRate ?? 0}%`, icon: Clock3, color: 'text-amber-600 bg-amber-50' }
  ];

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Tiến độ học tập</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Kết quả &amp; Phân tích</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Tổng hợp điểm và lịch sử các bài kiểm tra, bài tập đã nộp của bạn.
        </p>
      </header>

      <section aria-label="Tổng quan kết quả học tập" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-extrabold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="font-bold text-gray-900">Lịch sử làm bài</h2>
          <p className="mt-1 text-xs text-gray-500">Kết quả được tải từ các lượt làm đã lưu trong hệ thống.</p>
        </div>

        {results.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ClipboardList className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <h3 className="mb-2 font-bold text-gray-800">Chưa có kết quả nào</h3>
            <p className="text-sm text-gray-500">Các bài đã nộp sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_100px_110px_145px] gap-4 bg-gray-50 px-6 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 md:grid">
              <span>Bài làm</span>
              <span>Khóa học</span>
              <span>Điểm</span>
              <span>Kết quả</span>
              <span>Thời gian</span>
            </div>
            <div className="divide-y divide-gray-100">
              {results.map((result) => (
                <article key={result.attemptId} className="grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_100px_110px_145px] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-gray-900">{result.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${result.type === 'Quiz' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                        {result.type === 'Quiz' ? 'Quiz' : 'Bài tập'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">{[result.chapterName, result.lessonName].filter(Boolean).join(' · ')}</p>
                  </div>
                  <p className="truncate text-xs text-gray-600">{result.courseName || '—'}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {result.score === null ? `Chờ chấm/${result.maxScore}` : `${result.score}/${result.maxScore}`}
                  </p>
                  <div>
                    {result.gradingStatus === 'Pending' || result.gradingStatus === 'Draft' ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                        {result.gradingStatus === 'Draft' ? 'Đang chấm' : 'Chờ chấm'}
                      </span>
                    ) : result.passed === null ? (
                      <span className="text-xs text-gray-400">Chưa xác định</span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {result.passed ? 'Đạt' : 'Chưa đạt'}
                      </span>
                    )}
                    {result.percentage !== null && <p className="mt-1 text-[11px] text-gray-500">{result.percentage}%</p>}
                  </div>
                  <time className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.startTime))}
                  </time>
                  {result.type === 'Quiz' && result.gradingStatus !== 'Pending' && result.gradingStatus !== 'Draft' && (
                    <div className="md:col-span-5">
                      <button
                        type="button"
                        onClick={() => void toggleAttemptDetail(result.attemptId)}
                        aria-expanded={detailAttemptId === result.attemptId}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        {detailAttemptId === result.attemptId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {detailAttemptId === result.attemptId ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                      </button>

                      {detailAttemptId === result.attemptId && (
                        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                          {detailLoading ? (
                            <p className="flex items-center gap-2 text-sm text-gray-500">
                              <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải chi tiết...
                            </p>
                          ) : detailError ? (
                            <p role="alert" className="text-sm text-red-700">{detailError}</p>
                          ) : attemptDetail?.attemptId === result.attemptId ? (
                            attemptDetail.questions.length === 0 ? (
                              <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <h4 className="text-sm font-semibold text-amber-900">Lượt làm này chưa lưu chi tiết từng câu</h4>
                                <p className="mt-1 text-sm text-amber-800">
                                  Kết quả tổng điểm vẫn được lưu, nhưng câu trả lời từng câu không có trong dữ liệu của lượt thi này.
                                  Các lượt quiz nộp từ thời điểm hệ thống lưu câu trả lời chi tiết sẽ hiển thị tại đây.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {attemptDetail.instructorFeedback && (
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                                    <h4 className="font-bold">Nhận xét của giảng viên</h4>
                                    <p className="mt-1 whitespace-pre-wrap">{attemptDetail.instructorFeedback}</p>
                                  </div>
                                )}
                                {attemptDetail.questions.map((question, questionIndex) => (
                                  <section key={`${result.attemptId}-${questionIndex}`} className="rounded-lg border border-gray-200 bg-white p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <h4 className="text-sm font-semibold text-gray-900">
                                        Câu {questionIndex + 1}. {question.question}
                                      </h4>
                                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${question.type === 'essay' ? 'bg-blue-50 text-blue-700' : question.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {question.type === 'essay' ? 'Đã chấm' : question.isCorrect ? 'Đúng' : 'Chưa đúng'} · {question.scoreEarned}/{question.points} điểm
                                      </span>
                                    </div>

                                    {(question.type === 'multipleChoice' || question.type === 'trueFalse') && question.options.length > 0 && (
                                      <ul className="mt-3 space-y-2">
                                        {question.options.map((option, optionIndex) => (
                                          <li
                                            key={`${option.content}-${optionIndex}`}
                                            className={`rounded-md border px-3 py-2 text-sm ${
                                              option.isCorrect
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : option.isSelected
                                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                  : 'border-gray-100 text-gray-600'
                                            }`}
                                          >
                                            {option.content}
                                            {option.isSelected && <span className="ml-2 text-xs font-semibold">(Bạn đã chọn)</span>}
                                            {option.isCorrect && <span className="ml-2 text-xs font-semibold">(Đáp án đúng)</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    )}

                                    {question.type !== 'multipleChoice' && question.type !== 'trueFalse' && (
                                      <div className="mt-3 space-y-1 text-sm">
                                        <p className="text-gray-700">
                                          Câu trả lời của bạn: <span className="font-medium">{question.selectedAnswer === null ? 'Chưa trả lời' : String(question.selectedAnswer)}</span>
                                        </p>
                                        {question.correctAnswers.length > 0 && (
                                          <p className="text-emerald-700">
                                            Đáp án đúng: <span className="font-medium">{question.correctAnswers.join(', ')}</span>
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {question.explanation && (
                                      <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                                        <span className="font-semibold text-gray-800">Giải thích: </span>{question.explanation}
                                      </p>
                                    )}
                                  </section>
                                ))}
                              </div>
                            )
                          ) : (
                            <p className="text-sm text-gray-500">Lượt làm này chưa có dữ liệu chi tiết từng câu.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
