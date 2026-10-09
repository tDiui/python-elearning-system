"use client";

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Save } from 'lucide-react';

interface EssayQuestion {
  submissionId: number;
  question: string;
  answer: string;
  maxPoints: number;
  score: number;
}

interface EssayAttempt {
  attemptId: number;
  status: 'Pending' | 'Draft';
  submittedAt: string;
  currentScore: number;
  maxScore: number;
  feedback: string;
  student: { name: string; email: string; studentId: string | null };
  quizTitle: string;
  courseName: string;
  chapterName: string;
  lessonName: string;
  questions: EssayQuestion[];
}

export default function EssayGradingPage() {
  const [attempts, setAttempts] = useState<EssayAttempt[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch('http://localhost:5000/api/teacher/essay-attempts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải danh sách bài tự luận.');
      }
      setAttempts(payload.data);
      setSelectedId((current) => current && payload.data.some((attempt: EssayAttempt) => attempt.attemptId === current)
        ? current
        : null);
    } catch (fetchError) {
      console.error('Lỗi tải danh sách bài tự luận:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải danh sách bài tự luận.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAttempts();
  }, [fetchAttempts]);

  const selectAttempt = (attempt: EssayAttempt) => {
    setSelectedId(attempt.attemptId);
    setScores(Object.fromEntries(attempt.questions.map((question) => [
      question.submissionId,
      String(question.score)
    ])));
    setFeedback(attempt.feedback);
    setError('');
    setNotice('');
  };

  const selectedAttempt = attempts.find((attempt) => attempt.attemptId === selectedId) || null;

  const saveGrades = async (action: 'Draft' | 'Published') => {
    if (!selectedAttempt || saving) return;
    setError('');
    setNotice('');

    const questions = selectedAttempt.questions.flatMap((question) => {
      const rawScore = scores[question.submissionId]?.trim();
      if (rawScore === undefined || rawScore === '') return [];
      const score = Number(rawScore);
      if (!Number.isFinite(score) || score < 0 || score > question.maxPoints) return [];
      return [{ submissionId: question.submissionId, score }];
    });

    if (action === 'Published' && questions.length !== selectedAttempt.questions.length) {
      setError('Vui lòng nhập điểm hợp lệ cho tất cả câu tự luận trước khi công bố.');
      return;
    }
    if (questions.length !== Object.values(scores).filter((value) => value.trim() !== '').length) {
      setError('Có điểm không hợp lệ hoặc vượt quá điểm tối đa của câu hỏi.');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại.');
      const response = await fetch(`http://localhost:5000/api/teacher/essay-attempts/${selectedAttempt.attemptId}/grade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, feedback, questions })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu kết quả chấm bài.');
      }
      setNotice(payload.message || 'Đã lưu kết quả chấm bài.');
      if (action === 'Published') {
        setSelectedId(null);
      }
      await fetchAttempts();
    } catch (saveError) {
      console.error('Lỗi lưu kết quả chấm bài:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu kết quả chấm bài.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Đánh giá bài làm</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Chấm bài tự luận</h1>
          <p className="mt-2 text-sm text-gray-500">Các câu trả lời trống cũng được giữ trong hàng chờ để giảng viên chấm.</p>
        </div>
        <button type="button" onClick={() => void fetchAttempts()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </button>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải bài cần chấm...</div>
      ) : attempts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h2 className="font-bold text-gray-900">Không có bài tự luận đang chờ chấm</h2>
          <p className="mt-2 text-sm text-gray-500">Bài làm mới sẽ xuất hiện tại đây sau khi học viên nộp.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.7fr)]">
          <section aria-label="Danh sách bài chờ chấm" className="space-y-3">
            {attempts.map((attempt) => (
              <button
                type="button"
                key={attempt.attemptId}
                onClick={() => selectAttempt(attempt)}
                className={`w-full rounded-xl border p-4 text-left transition ${selectedId === attempt.attemptId ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-gray-900">{attempt.student.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attempt.status === 'Draft' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                    {attempt.status === 'Draft' ? 'Bản nháp' : 'Chờ chấm'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{attempt.quizTitle}</p>
                <p className="mt-2 text-[11px] text-gray-400">{attempt.courseName} · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.submittedAt))}</p>
              </button>
            ))}
          </section>

          {selectedAttempt ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6 border-b border-gray-100 pb-5">
                <h2 className="text-xl font-extrabold text-gray-900">{selectedAttempt.quizTitle}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedAttempt.student.name} · {selectedAttempt.student.email}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {selectedAttempt.student.studentId ? `MSSV ${selectedAttempt.student.studentId} · ` : ''}
                  {[selectedAttempt.courseName, selectedAttempt.chapterName, selectedAttempt.lessonName].filter(Boolean).join(' · ')}
                </p>
              </div>

              <div className="space-y-5">
                {selectedAttempt.questions.map((question, index) => (
                  <article key={question.submissionId} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-sm font-bold leading-6 text-gray-900">Câu {index + 1}. {question.question}</h3>
                      <span className="shrink-0 text-xs font-semibold text-gray-500">Tối đa {question.maxPoints} điểm</span>
                    </div>
                    <p className={`mt-3 whitespace-pre-wrap rounded-lg p-3 text-sm ${question.answer.trim() ? 'bg-gray-50 text-gray-700' : 'border border-dashed border-amber-300 bg-amber-50 text-amber-800'}`}>
                      {question.answer.trim() || 'Học viên để trống câu trả lời.'}
                    </p>
                    <label className="mt-4 block max-w-xs text-xs font-bold text-gray-600">
                      Điểm câu này
                      <input
                        type="number"
                        min="0"
                        max={question.maxPoints}
                        step="0.01"
                        value={scores[question.submissionId] ?? ''}
                        onChange={(event) => setScores((current) => ({ ...current, [question.submissionId]: event.target.value }))}
                        className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </article>
                ))}
              </div>

              <label className="mt-5 block text-xs font-bold text-gray-600">
                Nhận xét chung
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" disabled={saving} onClick={() => void saveGrades('Draft')} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  <Save className="h-4 w-4" /> Lưu bản nháp
                </button>
                <button type="button" disabled={saving} onClick={() => void saveGrades('Published')} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Lưu và công bố'}
                </button>
              </div>
            </section>
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
              Chọn một lượt làm để xem câu trả lời và chấm điểm.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
