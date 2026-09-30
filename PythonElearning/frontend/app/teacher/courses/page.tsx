"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ExerciseTab from './components/ExerciseTab';
import QuizTab from './components/QuizTab';

type CourseStats = { lessons: number; exercises: number; quizzes: number; };
type Exercise = { id: number; title: string; };
type Lesson = { id: number; title: string; isDraft: boolean; content: string; objectives: string[]; codeExample: string; exercises: Exercise[]; };
type Chapter = { id: number; title: string; progress: string; lessons: Lesson[]; };
type CourseData = { id: number; title: string; stats: CourseStats; chapters: Chapter[]; };
type ModalType = 'course' | 'chapter' | 'lesson' | 'edit-chapter' | 'edit-lesson' | 'exercise' | 'quiz' | null;
type LessonField = 'content' | 'objectives' | 'codeExample';

export default function CourseManagementPage() {
  const router = useRouter();

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'exercises' | 'quizzes'>('lessons');
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalInput, setModalInput] = useState('');
  const [targetChapterId, setTargetChapterId] = useState<number | null>(null);
  const [targetLessonId, setTargetLessonId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalDifficulty, setModalDifficulty] = useState('Easy');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentValue, setEditContentValue] = useState('');
  

  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editObjectives, setEditObjectives] = useState<string[]>([]);
  const [isEditingCode, setIsEditingCode] = useState(false);
  type FilterDiff = 'All' | 'Easy' | 'Medium' | 'Hard';
  type FilterStatus = 'All' | 'Published' | 'Draft';
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDiff>('All');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [exerciseStats, setExerciseStats] = useState({ easy: 0, medium: 0, hard: 0, published: 0, draft: 0 });
  const [editCodeValue, setEditCodeValue] = useState('');

const fetchCourseData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      const response = await fetch('http://localhost:5000/api/teacher/course-management', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success && result.data) {
        setCourseData(result.data);
        
        // SỬA LỖI Ở ĐÂY: Dùng callback prev để không bị phụ thuộc vòng lặp
        setExpandedChapters(prev => {
          if (prev.length === 0 && result.data.chapters.length > 0) {
            return [result.data.chapters[0].id];
          }
          return prev;
        });
        
      } else {
        setCourseData(null);
      }
    } catch (error) {
      console.error('Lỗi tải Course Management:', error);
    } finally {
      setLoading(false);
    }
  }, [router]); // XÓA expandedChapters.length KHỎI ĐÂY

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCourseData();
  }, [fetchCourseData]);

  const resetLessonEditors = () => {
    setIsEditingContent(false);
    setIsEditingObjectives(false);
    setIsEditingCode(false);
  };

  const handleSelectLesson = (lessonId: number) => {
    setActiveLessonId(lessonId);
    resetLessonEditors();
  };

const handleSaveModal = async () => {
    if (!modalInput.trim()) return;
    setIsSubmitting(true);
    
    const token = localStorage.getItem('token');
    let endpoint = '';
    let method = 'POST';
    let payload = {};

    if (modalType === 'course') {
      endpoint = '/api/teacher/course';
      payload = { title: modalInput };
    } else if (modalType === 'chapter') {
      endpoint = '/api/teacher/chapter';
      payload = { courseId: courseData?.id, title: modalInput };
    } else if (modalType === 'lesson') {
      endpoint = '/api/teacher/lesson';
      payload = { chapterId: targetChapterId, title: modalInput };
    } else if (modalType === 'edit-chapter') {
      endpoint = `/api/teacher/chapter/${targetChapterId}`;
      method = 'PUT';
      payload = { title: modalInput };
    } else if (modalType === 'edit-lesson') {
      endpoint = `/api/teacher/lesson/${targetLessonId}`;
      method = 'PUT';
      payload = { title: modalInput };
    } else if (modalType === 'exercise') {
      if (!targetLessonId) {
        alert("Vui lòng chọn Chủ đề (Bài học) cho bài tập!");
        setIsSubmitting(false);
        return;
      }
      endpoint = '/api/teacher/exercise';
      payload = { lessonId: targetLessonId, title: modalInput, difficulty: modalDifficulty };
    }
     else if (modalType === 'quiz') {
      if (!targetLessonId) {
        alert("Vui lòng chọn Chủ đề (Bài học) cho bài kiểm tra!");
        setIsSubmitting(false);
        return;
      }
      endpoint = '/api/teacher/quiz';
      payload = { lessonId: targetLessonId, title: modalInput };
    }

    try {
      await fetch(`http://localhost:5000${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      setModalInput('');
      fetchCourseData();
    } catch (error) {
      console.error('Lỗi lưu dữ liệu:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. HÀM CẬP NHẬT CHUNG CHO CẢ 3 TRƯỜNG (Content, Objectives, Code)
  const handleUpdateLessonField = async (field: LessonField, value: string | string[]) => {
    if (!activeLessonId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        if (field === 'content') setIsEditingContent(false);
        if (field === 'objectives') setIsEditingObjectives(false);
        if (field === 'codeExample') setIsEditingCode(false);
        fetchCourseData();
      }
    } catch (error) {
      console.error('Lỗi lưu thay đổi:', error);
    }
  };

  const handleDeleteChapter = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa Chapter này và TOÀN BỘ bài học bên trong không?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/api/teacher/chapter/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchCourseData();
    } catch (error) { console.error('Lỗi xóa Chapter:', error); }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa Bài học này không?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/api/teacher/lesson/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (activeLessonId === id) {
        setActiveLessonId(null);
        resetLessonEditors();
      }
      fetchCourseData();
    } catch (error) { console.error('Lỗi xóa Bài học:', error); }
  };

  // 6. HÀM XÓA BÀI TẬP LIÊN KẾT
  const handleDeleteExercise = async (id: number) => {
    if (!window.confirm('Xóa bài tập này?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/api/teacher/exercise/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchCourseData();
    } catch (error) { console.error('Lỗi xóa Bài tập:', error); }
  };

const openModal = (type: ModalType, chapterId?: number | null, lessonId?: number | null, initialValue: string = '') => {
    setModalType(type);
    setTargetChapterId(chapterId || null);
    
    // Tự động gán sẵn Lesson đầu tiên nếu đang tạo Bài tập từ Tab "Bài tập"
// Thay thế đoạn if (type === 'exercise' && ...) thành:
    if ((type === 'exercise' || type === 'quiz') && !lessonId && courseData?.chapters?.[0]?.lessons?.[0]) {
      setTargetLessonId(courseData.chapters[0].lessons[0].id);
    } else {
      setTargetLessonId(lessonId || null);
    }
    
    setModalDifficulty('Easy');
    setModalInput(initialValue);
    setIsModalOpen(true);
  };


  const handleToggleChapter = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn chặn sự kiện click lan truyền
    setExpandedChapters(currentExpanded => {
      if (currentExpanded.includes(chapterId)) {
        return currentExpanded.filter(id => id !== chapterId);
      } else {
        return [...currentExpanded, chapterId];
      }
    });
  };

  if (loading) return <div className="flex h-full items-center justify-center">Đang tải...</div>;

  const safeCourseData: CourseData = courseData || {
    id: 0,
    title: 'Chưa có khóa học',
    stats: { lessons: 0, exercises: 0, quizzes: 0 },
    chapters: []
  };
  let activeLesson: Lesson | null = null;
  
  if (courseData) {
    for (const chapter of courseData.chapters) {
      const found = chapter.lessons.find(l => l.id === activeLessonId);
      if (found) { activeLesson = found; break; }
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] -m-8 relative">
      
      {/* SIDEBAR PHỤ */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Khóa học</p>
          <h2 className="font-bold text-gray-900 leading-tight truncate" title={safeCourseData.title}>{safeCourseData.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-100 space-y-1">
            <button onClick={() => setActiveTab('lessons')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'lessons' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3"><span className={activeTab === 'lessons' ? 'text-blue-500' : 'text-gray-400'}>📄</span> Bài học</div>
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${activeTab === 'lessons' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{safeCourseData.stats.lessons}</span>
            </button>
            <button onClick={() => setActiveTab('exercises')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'exercises' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3"><span className={activeTab === 'exercises' ? 'text-blue-500' : 'text-gray-400'}>‹›</span> Bài tập</div>
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${activeTab === 'exercises' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{safeCourseData.stats.exercises}</span>
            </button>
            <button onClick={() => setActiveTab('quizzes')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quizzes' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-3"><span className={activeTab === 'quizzes' ? 'text-blue-500' : 'text-gray-400'}>📝</span> Kiểm tra</div>
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${activeTab === 'quizzes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{safeCourseData.stats.quizzes}</span>
            </button>
          </div>
          
          {activeTab === 'lessons' && courseData && (
            <div className="p-3">
              {safeCourseData.chapters.map((chapter) => {
                const isExpanded = expandedChapters.includes(chapter.id);
                return (
                  <div key={chapter.id} className="mb-2">
                    <div 
                      className="group w-full flex items-center justify-between px-2 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" 
                      onClick={(e) => handleToggleChapter(chapter.id, e)}>
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] text-gray-400 shrink-0">{isExpanded ? '▼' : '▶'}</span>
                        <span className="truncate">{chapter.title}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); openModal('edit-chapter', chapter.id, null, chapter.title); }} className="p-1 hover:bg-blue-100 rounded text-blue-500 text-xs">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }} className="p-1 hover:bg-red-100 rounded text-red-500 text-xs">🗑️</button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="ml-5 mt-1 border-l-2 border-gray-100 pl-3 flex flex-col gap-1">
                        {chapter.lessons.map(lesson => (
                          <div 
                            key={lesson.id} 
                            onClick={() => handleSelectLesson(lesson.id)}
                            className={`group flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] rounded-md cursor-pointer transition-colors ${activeLessonId === lesson.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeLessonId === lesson.id ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                              <span className="truncate">{lesson.title}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={(e) => { e.stopPropagation(); openModal('edit-lesson', chapter.id, lesson.id, lesson.title); }} className="p-1 hover:bg-blue-200 rounded text-blue-600 text-[10px]">✏️</button>
                               <button onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }} className="p-1 hover:bg-red-200 rounded text-red-600 text-[10px]">🗑️</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => openModal('lesson', chapter.id)} className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-blue-500 hover:text-blue-700 font-medium mt-1">
                          + Thêm bài học
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* KHỐI THỐNG KÊ & BỘ LỌC KHI Ở TAB BÀI TẬP */}
          {activeTab === 'exercises' && (
            <div className="p-5 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Theo độ khó</p>
              <div className="space-y-1 mb-8">
                <div onClick={() => setFilterDifficulty(filterDifficulty === 'Easy' ? 'All' : 'Easy')} className={`flex justify-between items-center text-sm p-2 rounded-lg cursor-pointer transition-colors ${filterDifficulty === 'Easy' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 font-bold rounded-full text-[11px]">Easy</span>
                  <span className="text-gray-500 font-medium text-xs">{exerciseStats.easy} bài</span>
                </div>
                <div onClick={() => setFilterDifficulty(filterDifficulty === 'Medium' ? 'All' : 'Medium')} className={`flex justify-between items-center text-sm p-2 rounded-lg cursor-pointer transition-colors ${filterDifficulty === 'Medium' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-500 font-bold rounded-full text-[11px]">Medium</span>
                  <span className="text-gray-500 font-medium text-xs">{exerciseStats.medium} bài</span>
                </div>
                <div onClick={() => setFilterDifficulty(filterDifficulty === 'Hard' ? 'All' : 'Hard')} className={`flex justify-between items-center text-sm p-2 rounded-lg cursor-pointer transition-colors ${filterDifficulty === 'Hard' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <span className="px-2.5 py-1 bg-red-50 text-red-600 font-bold rounded-full text-[11px]">Hard</span>
                  <span className="text-gray-500 font-medium text-xs">{exerciseStats.hard} bài</span>
                </div>
              </div>

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Trạng thái</p>
              <div className="space-y-1">
                <div onClick={() => setFilterStatus(filterStatus === 'Published' ? 'All' : 'Published')} className={`flex justify-between items-center text-sm p-2 rounded-lg cursor-pointer transition-colors ${filterStatus === 'Published' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className={`font-medium ${filterStatus === 'Published' ? 'text-blue-700' : 'text-gray-600'}`}>Published</span>
                  </div>
                  <span className="text-gray-500 font-medium text-xs">{exerciseStats.published}</span>
                </div>
                <div onClick={() => setFilterStatus(filterStatus === 'Draft' ? 'All' : 'Draft')} className={`flex justify-between items-center text-sm p-2 rounded-lg cursor-pointer transition-colors ${filterStatus === 'Draft' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className={`font-medium ${filterStatus === 'Draft' ? 'text-blue-700' : 'text-gray-600'}`}>Draft</span>
                  </div>
                  <span className="text-gray-500 font-medium text-xs">{exerciseStats.draft}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        
        {activeTab === 'lessons' && (
           <div className="p-4 border-t border-gray-100 bg-gray-50">
             <button onClick={() => courseData ? openModal('chapter') : openModal('course')} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
               {courseData ? '+ Thêm Chapter' : '+ Tạo khóa học mới'}
             </button>
           </div>
        )}
      </div>

      {/* KHU VỰC NỘI DUNG CHÍNH (BÊN PHẢI) */}
      <div className="flex-1 bg-white overflow-y-auto p-8 relative">
        
        {!courseData ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">📂</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Chưa có khóa học nào</h2>
            <p className="text-gray-500 text-sm mb-6">Vui lòng tạo khóa học đầu tiên của bạn để bắt đầu thêm bài giảng.</p>
            <button onClick={() => openModal('course')} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Tạo khóa học ngay</button>
          </div>
        ) : activeTab === 'lessons' && !activeLesson ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">Chọn một bài học bên trái hoặc tạo bài học mới.</div>
        ) : activeTab === 'lessons' && activeLesson ? (
          <div className="max-w-4xl mx-auto pb-12">
            
            {/* Header Bài học */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">✓ Published</span>
                  <span className="text-xs font-medium text-blue-600">Bài học</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">{activeLesson.title}</h1>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Preview</button>
                <button className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">✓ Publish</button>
              </div>
            </div>

            {/* Khối 1: Mục tiêu học tập (Dữ liệu thật) */}
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Mục tiêu học tập</h3>
                {!isEditingObjectives ? (
                  <button 
                    onClick={() => { setIsEditingObjectives(true); setEditObjectives([...activeLesson!.objectives]); }} 
                    className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                  >
                    + Thêm / Sửa
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingObjectives(false)} className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">Hủy</button>
                    <button onClick={() => handleUpdateLessonField('objectives', editObjectives)} className="text-xs text-white bg-blue-600 px-3 py-1.5 rounded-md">💾 Lưu</button>
                  </div>
                )}
              </div>
              
              {!isEditingObjectives ? (
                <div className="space-y-3">
                  {!activeLesson.objectives || activeLesson.objectives.length === 0 ? <p className="text-sm text-gray-400 italic">Chưa có mục tiêu học tập.</p> : null}
                  {activeLesson.objectives?.map((obj, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">{idx + 1}</span>
                      {obj}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {editObjectives.map((obj, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={obj} onChange={(e) => { const newObjs = [...editObjectives]; newObjs[idx] = e.target.value; setEditObjectives(newObjs); }} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500" placeholder="Nhập mục tiêu học tập..." />
                      <button onClick={() => setEditObjectives(editObjectives.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 px-2 rounded-lg">🗑️</button>
                    </div>
                  ))}
                  <button onClick={() => setEditObjectives([...editObjectives, ''])} className="text-xs font-medium text-blue-600">+ Thêm dòng mới</button>
                </div>
              )}
            </div>

            {/* Khối 2: Nội dung bài học (Dữ liệu thật) */}
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Nội dung bài học</h3>
                {!isEditingContent ? (
                  <button 
                    onClick={() => { setIsEditingContent(true); setEditContentValue(activeLesson.content); }} 
                    className="text-xs text-blue-600 font-medium hover:underline bg-blue-50 px-3 py-1.5 rounded-md flex items-center gap-1"
                  >
                    ✏️ Sửa nội dung
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingContent(false)} className="text-xs text-gray-600 font-medium hover:bg-gray-100 px-3 py-1.5 rounded-md">Hủy</button>
                    <button onClick={() => handleUpdateLessonField('content', editContentValue)} className="text-xs text-white bg-blue-600 font-medium hover:bg-blue-700 px-3 py-1.5 rounded-md">💾 Lưu thay đổi</button>
                  </div>
                )}
              </div>
              
              {isEditingContent ? (
                <textarea 
                  className="w-full h-48 p-4 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white leading-relaxed shadow-inner"
                  value={editContentValue}
                  onChange={(e) => setEditContentValue(e.target.value)}
                  placeholder="Nhập nội dung HTML hoặc văn bản tại đây..."
                />
              ) : (
                <div 
                  className="bg-gray-50 p-6 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed font-mono min-h-30 shadow-inner prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: activeLesson.content }} 
                />
              )}
            </div>

            {/* Khối 3: Code Example (Dữ liệu thật) */}
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Code Example</h3>
                {!isEditingCode ? (
                  <button 
                    onClick={() => { setIsEditingCode(true); setEditCodeValue(activeLesson!.codeExample); }} 
                    className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                  >
                    ✏️ Sửa code
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingCode(false)} className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">Hủy</button>
                    <button onClick={() => handleUpdateLessonField('codeExample', editCodeValue)} className="text-xs text-white bg-blue-600 px-3 py-1.5 rounded-md">💾 Lưu code</button>
                  </div>
                )}
              </div>
              
              {isEditingCode ? (
                <textarea 
                  className="w-full h-48 p-4 border border-blue-400 rounded-lg bg-[#0f172a] text-green-400 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={editCodeValue}
                  onChange={(e) => setEditCodeValue(e.target.value)}
                  placeholder="Nhập đoạn mã Python của bạn vào đây..."
                />
              ) : (
                <div className="bg-[#0f172a] p-5 rounded-xl text-sm font-mono text-gray-300 shadow-inner overflow-x-auto relative min-h-25 whitespace-pre-wrap">
                  {!activeLesson.codeExample ? <span className="text-gray-500 italic">Chưa có Code Example.</span> : activeLesson.codeExample}
                </div>
              )}
            </div>

            {/* Khối 4: Bài tập liên kết (Dữ liệu thật) */}
            <div className="border border-gray-200 rounded-xl p-6 shadow-sm mb-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Bài tập liên kết ({activeLesson.exercises?.length || 0})</h3>
                <button onClick={() => openModal('exercise', null, activeLesson!.id)} className="text-xs text-blue-600 hover:underline font-medium">+ Thêm bài tập</button>
              </div>
              
              <div className="space-y-3">
                {!activeLesson.exercises || activeLesson.exercises.length === 0 ? <p className="text-sm text-gray-400 italic">Chưa có bài tập nào được tạo.</p> : null}
                {activeLesson.exercises?.map(ex => (
                  <div key={ex.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-white hover:border-blue-200 transition-colors cursor-pointer group">
                     <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Exercise</span>
                        <span className="text-sm font-medium text-gray-700">{ex.title}</span>
                     </div>
                     <button onClick={() => handleDeleteExercise(ex.id)} className="text-gray-300 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-xl">×</button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : activeTab === 'quizzes' ? (
          <QuizTab onAddQuiz={() => openModal('quiz', null, null)} />
          
        ) : (
        
          <ExerciseTab 
            onAddExercise={() => openModal('exercise', null, null)} 
            filterDifficulty={filterDifficulty}
            setFilterDifficulty={setFilterDifficulty}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            onStatsChange={setExerciseStats}
          />
          
        )}
        
      </div>
      {isModalOpen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                {modalType === 'course' ? 'Tạo khóa học mới' : 
                 modalType === 'chapter' ? 'Tạo Chapter mới' : 
                 modalType === 'lesson' ? 'Tạo Bài học mới' : 
                 modalType === 'exercise' ? 'Tạo bài tập mới' : 
                 modalType === 'quiz' ? 'Tạo quiz mới' :
                 modalType === 'edit-chapter' ? 'Đổi tên Chapter' : 
                 modalType === 'edit-lesson' ? 'Đổi tên Bài học' : 'Nhập thông tin'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {/* Vùng nhập liệu */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">
                  {modalType === 'exercise' ? 'Tên bài tập' : modalType === 'quiz' ? 'Tên quiz' : 'Tiêu đề'}
                </label>
                <input 
                  type="text" 
                  placeholder={modalType === 'exercise' ? "VD: Calculate Factorial" : modalType === 'quiz' ? "VD: Chapter 3 Assessment" : "Nhập tiêu đề..."} 
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-gray-800"
                  autoFocus
                />
              </div>

              {/* Hiện Dropdown Chủ đề khi tạo Bài tập hoặc Quiz */}
              {(modalType === 'exercise' || modalType === 'quiz') && (
                <div className="flex gap-4">
                  <div className="flex-[2]">
                    <label className="text-xs font-bold text-gray-500 block mb-1">Chủ đề (Chapter)</label>
                    <select 
                      value={targetLessonId || ''} 
                      onChange={(e) => setTargetLessonId(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800"
                    >
                      <option value="" disabled>-- Chọn bài học --</option>
                      {courseData?.chapters.map(ch => (
                        <optgroup key={ch.id} label={`📂 ${ch.title}`}>
                          {ch.lessons.map(l => (
                            <option key={l.id} value={l.id}>{l.title}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  
                  {/* Cột bên phải: Độ khó (Exercise) hoặc Thời gian (Quiz) */}
                  {modalType === 'exercise' ? (
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 block mb-1">Độ khó</label>
                      <select 
                        value={modalDifficulty} 
                        onChange={(e) => setModalDifficulty(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1">
                       <label className="text-xs font-bold text-gray-500 block mb-1">Thời gian (phút)</label>
                       {/* Input bị mờ đi vì thời gian sẽ được tinh chỉnh chi tiết trong trình Editor */}
                       <input type="number" defaultValue={15} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none font-medium text-gray-500 cursor-not-allowed" title="Chỉnh sửa chi tiết bên trong Editor" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Các nút bấm */}
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-semibold transition-colors">
                Hủy
              </button>
              <button onClick={handleSaveModal} disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isSubmitting ? 'Đang xử lý...' : (modalType === 'exercise' || modalType === 'quiz') ? '+ Tạo & mở editor' : 'Lưu dữ liệu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}