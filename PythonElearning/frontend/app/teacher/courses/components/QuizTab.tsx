"use client";

import { useState, useEffect } from 'react';
import QuestionBankPanel, { type BankQuestion } from './QuestionBankPanel';

// ==========================================
// 1. KHAI BÁO TYPE CHO TYPESCRIPT
// ==========================================
type QuestionType = 'multipleChoice' | 'trueFalse' | 'fillIn' | 'essay';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: Option[]; // Dùng cho Trắc nghiệm
  correctAnswer?: boolean | string; // Dùng cho Đúng/Sai hoặc Điền vào
}

interface QuizConfig {
  questionCount: number;
  passScore: number;
  types: { multipleChoice: number; trueFalse: number; fillIn: number; essay: number; };
  tags: string[];
  questions: Question[]; // Mảng chứa chi tiết các câu hỏi
}

interface Quiz {
  id: number;
  title: string;
  chapter: string;
  timeLimit: number;
  status: string;
  config: QuizConfig;
  studentCount: number;
  attemptCount: number;
  averageScore: number;
  passRate: number;
}

interface QuizAttemptSummary {
  id: number;
  studentName: string;
  studentEmail: string;
  studentId: string | null;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number;
  maxScore: number;
  gradingStatus: string;
  questionCount: number;
}

interface QuizAttemptDetail extends Omit<QuizAttemptSummary, 'id'> {
  attemptId: number;
  quizTitle: string;
  instructorFeedback: string;
  questions: Array<{
    question: string;
    type: string;
    points: number;
    scoreEarned: number;
    isCorrect: boolean;
    selectedAnswer: string | boolean | null;
    correctAnswers: string[];
    options: Array<{ content: string; isCorrect: boolean; isSelected: boolean }>;
    explanation: string | null;
  }>;
}

interface QuizTabProps {
  courseId: number;
  onAddQuiz: () => void;
}

export default function QuizTab({ courseId, onAddQuiz }: QuizTabProps) {
  // ==========================================
  // 2. STATE QUẢN LÝ DỮ LIỆU
  // ==========================================
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [attemptsQuiz, setAttemptsQuiz] = useState<Quiz | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptSummary[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttemptDetail | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState('');
  const [questionBankMode, setQuestionBankMode] = useState<'manage' | 'select' | null>(null);
  const [quizEditorError, setQuizEditorError] = useState('');

  const fetchQuizzes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/teacher/quizzes', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setQuizzes(data.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
// Hàm xử lý xóa Quiz
  const handleDeleteQuiz = async (id: number, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài kiểm tra "${title}" không?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/teacher/exercise/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        setQuizzes(prev => prev.filter(q => q.id !== id)); // Xóa khỏi giao diện
      } else {
        alert(data.message || "Lỗi khi xóa!");
      }
    } catch (err) { console.error(err); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchQuizzes(); }, []);

  // Hàm gọi API cập nhật Quiz (Cả trạng thái, thời gian, và nội dung câu hỏi)
  const handleUpdateQuiz = async (
    field: keyof Quiz | 'config',
    value: string | number | QuizConfig
  ) => {
    if (!activeQuiz) return false;
    
    // Tạo bản sao của Quiz hiện tại với dữ liệu mới
    const updatedQuiz = { ...activeQuiz, [field]: value };
    
    try {
      const token = localStorage.getItem('token');
      // Ở backend, để update Quiz, ta tận dụng lại API update Exercise (vì chung bảng)
      // Nhưng đối với config, ta cần chuỗi hóa JSON
      const payload: Record<string, unknown> = {};
      
      if (field === 'config') {
        payload.QuizConfig = JSON.stringify(value);
      } else if (field === 'status') {
         payload.status = value;
      } else if (field === 'timeLimit') {
         payload.timeLimit = value;
      } else if (field === 'title') {
         payload.title = value;
      }

      const response = await fetch(`http://localhost:5000/api/teacher/exercise/${activeQuiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể cập nhật bài kiểm tra.');
      }
      
      setActiveQuiz(updatedQuiz);
      setQuizEditorError('');
      void fetchQuizzes();
      return true;
    } catch (error) {
      console.error('Lỗi cập nhật Quiz', error);
      setQuizEditorError(error instanceof Error ? error.message : 'Không thể cập nhật bài kiểm tra.');
      return false;
    }
  };

  const handleUseBankQuestion = async (bankQuestion: BankQuestion) => {
    if (!activeQuiz) return;
    const newQuestion: Question = {
      ...bankQuestion,
      id: `${bankQuestion.id}-${Date.now()}`,
      options: bankQuestion.options?.map((option) => ({ ...option }))
    };
    const newConfig: QuizConfig = {
      ...activeQuiz.config,
      types: {
        multipleChoice: activeQuiz.config.types?.multipleChoice ?? 0,
        trueFalse: activeQuiz.config.types?.trueFalse ?? 0,
        fillIn: activeQuiz.config.types?.fillIn ?? 0,
        essay: activeQuiz.config.types?.essay ?? 0
      },
      questions: [...(activeQuiz.config.questions || []), newQuestion]
    };
    newConfig.types[newQuestion.type] += 1;
    newConfig.questionCount = newConfig.questions.length;
    if (await handleUpdateQuiz('config', newConfig)) setQuestionBankMode(null);
  };

  const handleShowAttempts = async (quiz: Quiz) => {
    setAttemptsQuiz(quiz);
    setActiveAttempt(null);
    setQuizAttempts([]);
    setAttemptsError('');
    setAttemptsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/teacher/quiz/${quiz.id}/attempts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải danh sách lượt làm.');
      }
      setQuizAttempts(payload.data);
    } catch (error) {
      console.error('Lỗi tải lượt làm quiz:', error);
      setAttemptsError(error instanceof Error ? error.message : 'Không thể tải danh sách lượt làm.');
    } finally {
      setAttemptsLoading(false);
    }
  };

  const handleShowAttemptDetail = async (attemptId: number) => {
    if (!attemptsQuiz) return;
    setAttemptsLoading(true);
    setAttemptsError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/teacher/quiz/${attemptsQuiz.id}/attempts/${attemptId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải chi tiết lượt làm.');
      }
      setActiveAttempt(payload.data);
    } catch (error) {
      console.error('Lỗi tải chi tiết lượt làm quiz:', error);
      setAttemptsError(error instanceof Error ? error.message : 'Không thể tải chi tiết lượt làm.');
    } finally {
      setAttemptsLoading(false);
    }
  };

  // Hàm thêm câu hỏi mới
  const addQuestion = (type: QuestionType) => {
    if (!activeQuiz) return;
    
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: type,
      text: '',
      points: 1,
    };

    if (type === 'multipleChoice') {
      newQuestion.options = [
        { id: '1', text: '', isCorrect: true },
        { id: '2', text: '', isCorrect: false },
        { id: '3', text: '', isCorrect: false },
        { id: '4', text: '', isCorrect: false },
      ];
    } else if (type === 'trueFalse') {
      newQuestion.correctAnswer = true;
    } else if (type === 'fillIn') {
      newQuestion.correctAnswer = '';
    }

    const newConfig = {
      ...activeQuiz.config,
      types: {
        multipleChoice: activeQuiz.config.types?.multipleChoice ?? 0,
        trueFalse: activeQuiz.config.types?.trueFalse ?? 0,
        fillIn: activeQuiz.config.types?.fillIn ?? 0,
        essay: activeQuiz.config.types?.essay ?? 0
      }
    };
    
    // Đảm bảo mảng questions luôn tồn tại trước khi push
    if (!newConfig.questions) {
      newConfig.questions = [];
    }
    
    newConfig.questions.push(newQuestion);
    
    // Cập nhật lại số lượng loại câu hỏi
    newConfig.types[type]++;
    newConfig.questionCount++;

    handleUpdateQuiz('config', newConfig);
  };

  // Hàm cập nhật nội dung một câu hỏi cụ thể
  const updateQuestion = (qIndex: number, field: keyof Question, value: Question[keyof Question]) => {
    if (!activeQuiz) return;
    const newConfig = { ...activeQuiz.config };
    newConfig.questions[qIndex] = { ...newConfig.questions[qIndex], [field]: value };
    handleUpdateQuiz('config', newConfig);
  };

  // Xóa câu hỏi
  const deleteQuestion = (qIndex: number) => {
    if (!activeQuiz) return;
    const newConfig = {
      ...activeQuiz.config,
      types: {
        multipleChoice: activeQuiz.config.types?.multipleChoice ?? 0,
        trueFalse: activeQuiz.config.types?.trueFalse ?? 0,
        fillIn: activeQuiz.config.types?.fillIn ?? 0,
        essay: activeQuiz.config.types?.essay ?? 0
      }
    };
    const deletedType = newConfig.questions[qIndex].type;
    
    newConfig.questions.splice(qIndex, 1);
    newConfig.types[deletedType]--;
    newConfig.questionCount--;

    handleUpdateQuiz('config', newConfig);
  };

  if (loading) return <div className="text-center py-10">Đang tải danh sách bài kiểm tra...</div>;

  if (questionBankMode === 'manage' && !activeQuiz) {
    return (
      <QuestionBankPanel
        courseId={courseId}
        mode="manage"
        onClose={() => setQuestionBankMode(null)}
      />
    );
  }

  if (questionBankMode === 'select' && activeQuiz) {
    return (
      <div>
        {quizEditorError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{quizEditorError}</p>}
        <QuestionBankPanel
          courseId={courseId}
          mode="select"
          onClose={() => setQuestionBankMode(null)}
          onSelectQuestion={(question) => void handleUseBankQuestion(question)}
        />
      </div>
    );
  }

  if (attemptsQuiz) {
    if (activeAttempt) {
      return (
        <div className="mx-auto max-w-5xl pb-12">
          <button
            type="button"
            onClick={() => { setActiveAttempt(null); setAttemptsError(''); }}
            className="mb-5 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            ← Quay lại danh sách lượt làm
          </button>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{activeAttempt.quizTitle}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {activeAttempt.studentName} · {activeAttempt.studentEmail}
                  {activeAttempt.studentId ? ` · MSSV ${activeAttempt.studentId}` : ''}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Nộp bài: {activeAttempt.submittedAt ? new Date(activeAttempt.submittedAt).toLocaleString('vi-VN') : 'Chưa nộp'}
                  {' · '}Trạng thái: {activeAttempt.gradingStatus}
                </p>
              </div>
              <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">
                Điểm: {activeAttempt.totalScore}/{activeAttempt.maxScore}
              </p>
            </div>

            {activeAttempt.instructorFeedback && (
              <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Nhận xét giảng viên:</strong> {activeAttempt.instructorFeedback}
              </div>
            )}

            <div className="mt-6 space-y-4">
              {activeAttempt.questions.map((question, index) => (
                <article key={`${activeAttempt.attemptId}-${index}`} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-semibold text-gray-900">{index + 1}. {question.question}</h2>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      question.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {question.isCorrect ? 'Đúng' : question.type === 'essay' && activeAttempt.gradingStatus !== 'Published' ? 'Chờ chấm' : 'Chưa đúng'}
                      {' · '}{question.scoreEarned}/{question.points} điểm
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-medium text-gray-500">Câu trả lời của học viên</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                    {question.selectedAnswer === null || question.selectedAnswer === ''
                      ? 'Không có câu trả lời'
                      : String(question.selectedAnswer)}
                  </p>
                  {question.options.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {question.options.map((option, optionIndex) => (
                        <li
                          key={`${optionIndex}-${option.content}`}
                          className={`rounded-md px-3 py-2 text-sm ${
                            option.isCorrect
                              ? 'bg-emerald-50 text-emerald-800'
                              : option.isSelected
                                ? 'bg-rose-50 text-rose-800'
                                : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {option.isSelected ? 'Đã chọn · ' : ''}{option.content}
                          {option.isCorrect ? ' · Đáp án đúng' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {question.correctAnswers.length > 0 && question.options.length === 0 && (
                    <p className="mt-2 text-sm text-emerald-700">
                      Đáp án đúng: {question.correctAnswers.join(', ')}
                    </p>
                  )}
                  {question.explanation && (
                    <p className="mt-3 text-sm text-gray-600">Giải thích: {question.explanation}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl pb-12">
        <button
          type="button"
          onClick={() => { setAttemptsQuiz(null); setQuizAttempts([]); setAttemptsError(''); }}
          className="mb-5 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          ← Quay lại danh sách bài kiểm tra
        </button>
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Lượt làm: {attemptsQuiz.title}</h1>
          <p className="mt-1 text-sm text-gray-500">Chọn một lượt làm để xem câu trả lời chi tiết.</p>
        </div>
        {attemptsError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{attemptsError}</p>}
        {attemptsLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Đang tải...</p>
        ) : quizAttempts.length ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {quizAttempts.map((attempt) => (
              <button
                type="button"
                key={attempt.id}
                onClick={() => void handleShowAttemptDetail(attempt.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 text-left last:border-b-0 hover:bg-blue-50"
              >
                <span>
                  <span className="block font-semibold text-gray-900">{attempt.studentName}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {attempt.studentEmail} · {attempt.submittedAt
                      ? new Date(attempt.submittedAt).toLocaleString('vi-VN')
                      : 'Chưa nộp'}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold text-gray-900">{attempt.totalScore}/{attempt.maxScore} điểm</span>
                  <span className="mt-1 block text-xs text-gray-500">{attempt.gradingStatus} · {attempt.questionCount} câu</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Chưa có lượt làm bài kiểm tra này.
          </p>
        )}
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN 1: DANH SÁCH BÀI KIỂM TRA (GRID)
  // ==========================================
  if (!activeQuiz) {
    const publishedCount = quizzes.filter(q => q.status === 'Published').length;
    return (
      <div className="max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Bài kiểm tra</h1>
            <p className="text-sm text-gray-500">{quizzes.length} quiz • {publishedCount} đã publish</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setQuestionBankMode('manage')} className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              Ngân hàng câu hỏi
            </button>
            <button onClick={onAddQuiz} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm flex items-center gap-2">
              + Tạo quiz mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${quiz.status === 'Published' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                    {quiz.status === 'Published' ? '✓ Published' : 'Draft'}
                  </span>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{quiz.chapter.replace('Chapter ', 'Ch ')}</span>
                </div>
                {/* Thay thế nút 📝 cũ bằng đoạn này */}
                <div className="flex gap-3">
                  <button onClick={() => setActiveQuiz(quiz)} title="Sửa bài" className="text-gray-400 hover:text-blue-600 text-xl transition-colors">📝</button>
                  <button onClick={() => handleDeleteQuiz(quiz.id, quiz.title)} title="Xóa bài" className="text-gray-400 hover:text-red-500 text-xl transition-colors">🗑️</button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-3">{quiz.title}</h3>
              
              <div className="flex flex-wrap gap-2 mb-6 min-h-[28px]">
                {quiz.config.tags.length > 0 ? (
                  quiz.config.tags.map((tag, i) => <span key={i} className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">{tag}</span>)
                ) : (
                  <span className="text-[11px] font-semibold text-gray-400 italic">Chưa có chủ đề đánh giá</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{quiz.config.questionCount}</div>
                  <div className="text-xs text-gray-500 font-medium">Câu hỏi</div>
                </div>
                <div className="text-center border-l border-r border-gray-200">
                  <div className="text-lg font-bold text-gray-900">{quiz.timeLimit}p</div>
                  <div className="text-xs text-gray-500 font-medium">Thời gian</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{quiz.config.passScore}%</div>
                  <div className="text-xs text-gray-500 font-medium">Pass score</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6 text-[11px] font-medium border-b border-gray-100 pb-5">
                <span className="text-gray-400 mr-1">Loại câu:</span>
                <span className="text-blue-600">Trắc nghiệm ×{quiz.config.types.multipleChoice}</span>
                <span className="text-blue-600">Đúng/Sai ×{quiz.config.types.trueFalse}</span>
                <span className="text-purple-600">Điền vào ×{quiz.config.types.fillIn}</span>
                <span className="text-amber-600">Tự luận ×{quiz.config.types.essay ?? 0}</span>
              </div>

              <div className="flex justify-between items-center h-10">
                <div className="flex items-center gap-3">
                  {quiz.status === 'Draft' && (
                    <button onClick={() => setActiveQuiz(quiz)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">
                      Mở editor
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleShowAttempts(quiz)}
                    className="px-3 py-2 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Xem lượt làm ({quiz.attemptCount})
                  </button>
                </div>
                {quiz.status !== 'Draft' && (
                  <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                    <span className="text-gray-900 font-bold">{quiz.studentCount}</span> sinh viên
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-900 font-bold">{quiz.attemptCount}</span> lượt làm
                    <span className="text-gray-300">•</span>
                    <span>Avg: <span className="text-emerald-600 font-bold">{quiz.averageScore}%</span></span>
                    <span className="text-gray-300">•</span>
                    <span>Pass: <span className="text-gray-900 font-bold">{quiz.passRate}%</span></span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div onClick={onAddQuiz} className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[350px] cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors group">
            <div className="text-4xl text-gray-300 group-hover:text-blue-500 mb-2">+</div>
            <p className="text-sm font-bold text-gray-400 group-hover:text-blue-600">Tạo quiz mới</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // GIAO DIỆN 2: CHỈNH SỬA CHI TIẾT BÀI KIỂM TRA
  // ==========================================
  const totalPoints = (activeQuiz.config.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* HEADER EDITOR */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div className="flex flex-col">
           <div className="flex items-center gap-3 mb-2">
             <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${activeQuiz.status === 'Published' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
               {activeQuiz.status === 'Published' ? '✓ Published' : 'Draft'}
             </span>
             <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Quiz</span>
             <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{activeQuiz.chapter.replace('Chapter ', 'Ch ')}</span>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setActiveQuiz(null)} className="text-gray-400 hover:text-gray-900 text-xl font-bold">←</button>
             <h1 className="text-3xl font-bold text-gray-900">{activeQuiz.title}</h1>
           </div>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200 flex items-center gap-2">
            ▶ Preview
          </button>
          <button onClick={() => handleUpdateQuiz('status', activeQuiz.status === 'Published' ? 'Draft' : 'Published')} className={`px-5 py-2 text-white rounded-lg text-sm font-bold shadow-sm ${activeQuiz.status === 'Published' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {activeQuiz.status === 'Published' ? 'Chuyển về Draft' : '✓ Publish'}
          </button>
        </div>
      </div>

      {/* CÀI ĐẶT CHUNG */}
      <div className="border border-gray-200 rounded-2xl p-6 mb-8 bg-white shadow-sm">
        <h3 className="font-bold text-gray-900 mb-6 text-lg">Cài đặt Quiz</h3>
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-500 block mb-2">Tên Quiz</label>
            <input type="text" value={activeQuiz.title} onChange={(e) => handleUpdateQuiz('title', e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">Thời gian (phút)</label>
            <input type="number" value={activeQuiz.timeLimit} onChange={(e) => handleUpdateQuiz('timeLimit', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">Điểm qua môn (%)</label>
            <input type="number" value={activeQuiz.config.passScore} onChange={(e) => handleUpdateQuiz('config', { ...activeQuiz.config, passScore: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 block mb-3">Chủ đề đánh giá (Tags)</label>
          <div className="flex flex-wrap gap-2 items-center">
            {activeQuiz.config.tags.map((tag, i) => (
              <span key={i} className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                {tag}
                <button onClick={() => {
                  const newTags = [...activeQuiz.config.tags];
                  newTags.splice(i, 1);
                  handleUpdateQuiz('config', { ...activeQuiz.config, tags: newTags });
                }} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
            <button onClick={() => {
              const tag = prompt("Nhập tag mới:");
              if (tag) handleUpdateQuiz('config', { ...activeQuiz.config, tags: [...activeQuiz.config.tags, tag] });
            }} className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-dashed border-blue-200">
              + Thêm topic
            </button>
          </div>
        </div>
        
        <div className="mt-6 pt-5 border-t border-gray-100 flex gap-6 text-sm">
          <span className="text-gray-500">Tổng câu hỏi: <strong className="text-gray-900">{activeQuiz.config.questionCount}</strong></span>
          <span className="text-gray-500">Tổng điểm: <strong className="text-gray-900">{totalPoints}</strong></span>
        </div>
      </div>

      {/* DANH SÁCH CÂU HỎI */}
      <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-bold text-gray-900 text-lg">Câu hỏi ({activeQuiz.config.questionCount})</h3>
          <div className="flex gap-4">
            <button onClick={() => setQuestionBankMode('select')} className="text-xs font-semibold text-blue-600 hover:text-blue-800">+ Chọn từ ngân hàng</button>
            <button onClick={() => addQuestion('multipleChoice')} className="text-xs font-semibold text-gray-500 hover:text-blue-600">+ Trắc nghiệm</button>
            <button onClick={() => addQuestion('trueFalse')} className="text-xs font-semibold text-gray-500 hover:text-blue-600">+ Đúng/Sai</button>
            <button onClick={() => addQuestion('fillIn')} className="text-xs font-semibold text-gray-500 hover:text-blue-600">+ Điền vào</button>
            <button onClick={() => addQuestion('essay')} className="text-xs font-semibold text-gray-500 hover:text-blue-600">+ Tự luận</button>
          </div>
          {quizEditorError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{quizEditorError}</p>}
        </div>

          <div className="space-y-6">
          {(activeQuiz.config.questions || []).map((q, index) => (
            <div key={q.id} className="border border-gray-100 rounded-xl p-5 relative group bg-gray-50/30 hover:bg-white hover:shadow-md transition-all">
              
              {/* Header Câu Hỏi */}
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-sm">{index + 1}</span>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${q.type === 'multipleChoice' ? 'bg-blue-50 text-blue-600' : q.type === 'trueFalse' ? 'bg-emerald-50 text-emerald-600' : q.type === 'essay' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'}`}>
                  {q.type === 'multipleChoice' ? 'Trắc nghiệm' : q.type === 'trueFalse' ? 'Đúng/Sai' : q.type === 'essay' ? 'Tự luận' : 'Điền vào'}
                </span>
                <div className="flex items-center gap-2 ml-2">
                   <span className="text-xs text-gray-400 font-medium">Điểm:</span>
                   <input type="number" value={q.points} onChange={(e) => updateQuestion(index, 'points', Number(e.target.value))} className="w-16 border border-gray-200 rounded p-1 text-xs text-center outline-none focus:border-blue-400" />
                </div>
                <button onClick={() => deleteQuestion(index)} className="absolute top-5 right-5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>

              {/* Nội dung câu hỏi */}
              <textarea value={q.text} onChange={(e) => updateQuestion(index, 'text', e.target.value)} placeholder="Nhập nội dung câu hỏi..." className="w-full border-none bg-transparent resize-none outline-none font-medium text-gray-800 mb-4 placeholder-gray-300" rows={2} />

              {/* Phần render đáp án tùy theo Loại câu hỏi */}
              <div className="pl-11">
                
                {/* 1. TRẮC NGHIỆM */}
                {q.type === 'multipleChoice' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oIndex) => (
                      <div key={opt.id} className={`flex items-center gap-3 p-2 rounded-lg border ${opt.isCorrect ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                        <button onClick={() => {
                          const newOptions = q.options!.map((o, i) => ({ ...o, isCorrect: i === oIndex }));
                          updateQuestion(index, 'options', newOptions);
                        }} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {String.fromCharCode(65 + oIndex)}
                        </button>
                        <input type="text" value={opt.text} onChange={(e) => {
                          const newOptions = [...q.options!];
                          newOptions[oIndex].text = e.target.value;
                          updateQuestion(index, 'options', newOptions);
                        }} placeholder={`Lựa chọn ${String.fromCharCode(65 + oIndex)}`} className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700" />
                        {opt.isCorrect && <span className="text-xs font-bold text-green-600 pr-2">✓ Đúng</span>}
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400 italic mt-2">ⓘ Click vào vòng tròn chữ cái để đánh dấu đáp án đúng</p>
                  </div>
                )}

                {/* 2. ĐÚNG / SAI */}
                {q.type === 'trueFalse' && (
                  <div className="flex gap-4">
                    <button onClick={() => updateQuestion(index, 'correctAnswer', true)} className={`px-6 py-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition-colors ${q.correctAnswer === true ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${q.correctAnswer === true ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                        {q.correctAnswer === true && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                      Đúng
                    </button>
                    <button onClick={() => updateQuestion(index, 'correctAnswer', false)} className={`px-6 py-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition-colors ${q.correctAnswer === false ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${q.correctAnswer === false ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                        {q.correctAnswer === false && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                      Sai
                    </button>
                  </div>
                )}

                {/* 3. ĐIỀN VÀO CHỖ TRỐNG */}
                {q.type === 'fillIn' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-500">Đáp án chính xác:</span>
                    <input type="text" value={q.correctAnswer as string} onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)} placeholder="Nhập từ/cụm từ đáp án..." className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                {q.type === 'essay' && (
                  <p className="text-sm text-amber-700">Câu trả lời sẽ do giảng viên chấm sau khi sinh viên nộp bài.</p>
                )}
              </div>
            </div>
          ))}
          
          <div onClick={() => addQuestion('multipleChoice')} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center justify-center text-sm font-bold text-gray-400 hover:bg-gray-50 hover:text-blue-500 cursor-pointer transition-colors">
            + Thêm câu hỏi mới
          </div>
        </div>
      </div>
    </div>
  );
}