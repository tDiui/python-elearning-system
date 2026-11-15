"use client";

import { useCallback, useEffect, useState } from 'react';

type QuestionType = 'multipleChoice' | 'trueFalse' | 'fillIn' | 'essay';

type BankOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type BankQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  explanation?: string;
  options?: BankOption[];
  correctAnswer?: boolean | string;
};

type Props = {
  courseId: number;
  mode: 'manage' | 'select';
  onClose: () => void;
  onSelectQuestion?: (question: BankQuestion) => void;
};

const createEmptyQuestion = (): BankQuestion => ({
  id: '',
  type: 'multipleChoice',
  text: '',
  points: 1,
  explanation: '',
  options: [
    { id: '1', text: '', isCorrect: true },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ],
});

export default function QuestionBankPanel({ courseId, mode, onClose, onSelectQuestion }: Props) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<BankQuestion | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/teacher/question-bank?courseId=${courseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải ngân hàng câu hỏi.');
      }
      setQuestions(payload.data);
    } catch (fetchError) {
      console.error('Lỗi tải ngân hàng câu hỏi:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Không thể tải ngân hàng câu hỏi.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuestions();
  }, [fetchQuestions]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const isEditing = Boolean(draft.id);
      const response = await fetch(
        isEditing
          ? `http://localhost:5000/api/teacher/question-bank/${draft.id}`
          : 'http://localhost:5000/api/teacher/question-bank',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ courseId, question: draft }),
        }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu câu hỏi.');
      }
      setDraft(null);
      await fetchQuestions();
    } catch (saveError) {
      console.error('Lỗi lưu câu hỏi ngân hàng:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu câu hỏi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (question: BankQuestion) => {
    if (!window.confirm('Xóa câu hỏi này khỏi ngân hàng? Các quiz đã sao chép câu hỏi sẽ không bị thay đổi.')) return;
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/teacher/question-bank/${question.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xóa câu hỏi.');
      }
      setQuestions((current) => current.filter((item) => item.id !== question.id));
    } catch (deleteError) {
      console.error('Lỗi xóa câu hỏi ngân hàng:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa câu hỏi.');
    }
  };

  const updateDraft = <K extends keyof BankQuestion>(key: K, value: BankQuestion[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const changeType = (type: QuestionType) => {
    if (!draft) return;
    const newDraft: BankQuestion = {
      ...draft,
      type,
      options: type === 'multipleChoice'
        ? [
            { id: '1', text: '', isCorrect: true },
            { id: '2', text: '', isCorrect: false },
          ]
        : undefined,
      correctAnswer: type === 'trueFalse' ? true : type === 'fillIn' ? '' : undefined,
    };
    setDraft(newDraft);
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'manage' ? 'Ngân hàng câu hỏi' : 'Thêm từ ngân hàng câu hỏi'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Câu hỏi thuộc khóa học này. Khi thêm vào quiz, một bản sao độc lập sẽ được tạo.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">
          Đóng
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {mode === 'manage' && (
        <button
          type="button"
          onClick={() => setDraft(createEmptyQuestion())}
          className="mb-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Tạo câu hỏi
        </button>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Đang tải ngân hàng câu hỏi...</p>
      ) : questions.length ? (
        <div className="space-y-3">
          {questions.map((question) => (
            <article key={question.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-blue-700">
                    {question.type} · {question.points} điểm
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-900">{question.text}</p>
                </div>
                <div className="flex gap-2">
                  {mode === 'select' ? (
                    <button
                      type="button"
                      onClick={() => onSelectQuestion?.(question)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Sao chép vào quiz
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setDraft({ ...question })} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200">Sửa</button>
                      <button type="button" onClick={() => void handleDelete(question)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Xóa</button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Ngân hàng câu hỏi của khóa học chưa có câu hỏi.
        </p>
      )}

      {draft && mode === 'manage' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bank-question-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="bank-question-title" className="mb-5 text-lg font-bold text-gray-900">
              {draft.id ? 'Sửa câu hỏi ngân hàng' : 'Tạo câu hỏi ngân hàng'}
            </h3>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Loại câu hỏi
                <select value={draft.type} onChange={(event) => changeType(event.target.value as QuestionType)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="multipleChoice">Trắc nghiệm</option>
                  <option value="trueFalse">Đúng/Sai</option>
                  <option value="fillIn">Điền vào</option>
                  <option value="essay">Tự luận</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Nội dung câu hỏi
                <textarea rows={3} value={draft.text} onChange={(event) => updateDraft('text', event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Điểm
                <input type="number" min="0.01" max="100" step="0.01" value={draft.points} onChange={(event) => updateDraft('points', Number(event.target.value))} className="mt-1.5 w-32 rounded-lg border border-gray-300 px-3 py-2" />
              </label>

              {draft.type === 'multipleChoice' && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Lựa chọn (chọn một đáp án đúng)</p>
                  {(draft.options || []).map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input type="radio" name="bank-correct-option" checked={option.isCorrect} onChange={() => updateDraft('options', draft.options?.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })))} />
                      <input value={option.text} onChange={(event) => updateDraft('options', draft.options?.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} placeholder={`Lựa chọn ${index + 1}`} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      {(draft.options?.length || 0) > 2 && (
                        <button type="button" onClick={() => {
                          const nextOptions = draft.options?.filter((_, itemIndex) => itemIndex !== index) || [];
                          if (option.isCorrect && nextOptions.length) nextOptions[0] = { ...nextOptions[0], isCorrect: true };
                          updateDraft('options', nextOptions);
                        }} className="px-2 text-red-600" aria-label="Xóa lựa chọn">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => updateDraft('options', [...(draft.options || []), { id: String(Date.now()), text: '', isCorrect: false }])} className="text-sm font-semibold text-blue-700">+ Thêm lựa chọn</button>
                </div>
              )}

              {draft.type === 'trueFalse' && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-gray-700">Đáp án đúng</legend>
                  {[true, false].map((answer) => (
                    <label key={String(answer)} className="mr-5 inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="radio" checked={draft.correctAnswer === answer} onChange={() => updateDraft('correctAnswer', answer)} />
                      {answer ? 'Đúng' : 'Sai'}
                    </label>
                  ))}
                </fieldset>
              )}

              {draft.type === 'fillIn' && (
                <label className="block text-sm font-medium text-gray-700">
                  Đáp án đúng
                  <input value={typeof draft.correctAnswer === 'string' ? draft.correctAnswer : ''} onChange={(event) => updateDraft('correctAnswer', event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
              )}

              <label className="block text-sm font-medium text-gray-700">
                Giải thích (không bắt buộc)
                <textarea rows={2} value={draft.explanation || ''} onChange={(event) => updateDraft('explanation', event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={() => setDraft(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Hủy</button>
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu câu hỏi'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
