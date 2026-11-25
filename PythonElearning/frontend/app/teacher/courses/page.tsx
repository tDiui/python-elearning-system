"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import ExerciseTab from './components/ExerciseTab';
import QuizTab from './components/QuizTab';

type CourseStats = { lessons: number; exercises: number; quizzes: number; };
type Exercise = { id: number; title: string; };
type Lesson = {
  id: number;
  title: string;
  isDraft: boolean;
  durationMinutes: number;
  completedStudentCount: number;
  completedStudents: Array<{ id: number; name: string }>;
  content: string;
  objectives: string[];
  codeExample: string;
  hasVideo: boolean;
  videoUrl: string;
  hasSlide: boolean;
  slideUrl: string;
  slideOriginalUrl: string;
  exercises: Exercise[];
};
type Chapter = { id: number; title: string; progress: string; lessons: Lesson[]; };
type CourseCategory = { id: number; name: string; description?: string; courseCount?: number; };
type CourseData = {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  categoryName: string;
  categories: CourseCategory[];
  status: string;
  stats: CourseStats;
  chapters: Chapter[];
};
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
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editSlideUrl, setEditSlideUrl] = useState('');
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [slideFile, setSlideFile] = useState<File | null>(null);
  const [isUploadingSlide, setIsUploadingSlide] = useState(false);
  const [isUpdatingLessonStatus, setIsUpdatingLessonStatus] = useState(false);
  const [isSavingDuration, setIsSavingDuration] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  type FilterDiff = 'All' | 'Easy' | 'Medium' | 'Hard';
  type FilterStatus = 'All' | 'Published' | 'Draft';
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDiff>('All');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [exerciseStats, setExerciseStats] = useState({ easy: 0, medium: 0, hard: 0, published: 0, draft: 0 });
  const [editCodeValue, setEditCodeValue] = useState('');
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [courseTitleInput, setCourseTitleInput] = useState('');
  const [courseDescriptionInput, setCourseDescriptionInput] = useState('');
  const [courseCategoryInput, setCourseCategoryInput] = useState('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [courseOptions, setCourseOptions] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<'create' | 'edit'>('create');
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryDescriptionInput, setCategoryDescriptionInput] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [newCourseCategoryId, setNewCourseCategoryId] = useState('');

const fetchCourseData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      const query = selectedCourseId ? `?courseId=${selectedCourseId}` : '';
      const response = await fetch(`http://localhost:5000/api/teacher/course-management${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();

      if (Array.isArray(result.courses)) {
        setCourseOptions(result.courses);
        if (!selectedCourseId && result.courses.length > 0) {
          setSelectedCourseId(String(result.courses[0].id));
        }
      }

      if (result.success && result.data) {
        setCourseData(result.data);
        setSelectedCategoryId(result.data.categoryId);
        
        // SỬA LỖI Ở ĐÂY: Dùng callback prev để không bị phụ thuộc vòng lặp
        setExpandedChapters(prev => {
          if (prev.length === 0 && result.data.chapters.length > 0) {
            return [result.data.chapters[0].id];
          }
          return prev;
        });
        
      } else {
        setCourseData(null);
        setSelectedCategoryId(null);
      }
    } catch (error) {
      console.error('Lỗi tải Course Management:', error);
    } finally {
      setLoading(false);
    }
  }, [router, selectedCourseId]); // XÓA expandedChapters.length KHỎI ĐÂY

  const fetchCategories = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      const response = await fetch('http://localhost:5000/api/teacher/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải danh mục.');
      }
      setCategories(result.categories || []);
    } catch (error) {
      console.error('Lỗi tải danh mục:', error);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCourseData();
  }, [fetchCourseData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategories();
  }, [fetchCategories]);

  const handleToggleLessonStatus = async () => {
    if (!activeLesson) return;
    const nextStatus = activeLesson.isDraft ? 'Published' : 'Draft';
    const confirmation = activeLesson.isDraft
      ? 'Xuất bản bài học này? Học viên đã được duyệt ghi danh có thể xem khi khóa học cũng đã được xuất bản.'
      : 'Chuyển bài học về Draft? Học viên sẽ không xem được cho đến khi xuất bản lại.';
    if (!window.confirm(confirmation)) return;

    setIsUpdatingLessonStatus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLesson.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật trạng thái bài học.');
      }
      resetLessonEditors();
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái bài học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái bài học.');
    } finally {
      setIsUpdatingLessonStatus(false);
    }
  };

  const handleSaveDuration = async () => {
    if (!activeLesson) return;
    const durationMinutes = Number(durationInput);
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0) {
      window.alert('Thời lượng phải là số phút nguyên không âm.');
      return;
    }

    setIsSavingDuration(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ durationMinutes }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu thời lượng bài học.');
      }
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi lưu thời lượng bài học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể lưu thời lượng bài học.');
    } finally {
      setIsSavingDuration(false);
    }
  };

  const resetLessonEditors = () => {
    setIsEditingContent(false);
    setIsEditingObjectives(false);
    setIsEditingCode(false);
    setIsEditingMedia(false);
    setMediaError('');
  };

  const handleSelectLesson = (lessonId: number) => {
    setActiveLessonId(lessonId);
    const lesson = courseData?.chapters.flatMap(chapter => chapter.lessons).find(item => item.id === lessonId);
    setDurationInput(String(lesson?.durationMinutes || 0));
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
      const categoryId = Number(newCourseCategoryId);
      payload = {
        title: modalInput.trim(),
        description: newCourseDescription.trim(),
        ...(Number.isSafeInteger(categoryId) && categoryId > 0 ? { categoryId } : {}),
      };
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
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (modalType === 'course') {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Không thể tạo khóa học.');
        }
        if (result.data?.id) {
          setSelectedCourseId(String(result.data.id));
        }
        setNewCourseDescription('');
        setNewCourseCategoryId('');
      }
      setIsModalOpen(false);
      setModalInput('');
      if (modalType !== 'course') {
        fetchCourseData();
      }
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

  const handleSaveMedia = async () => {
    if (!activeLessonId || !activeLesson) return;
    setIsSavingMedia(true);
    setMediaError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLessonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoUrl: editVideoUrl.trim(),
          ...(activeLesson.slideOriginalUrl && !editSlideUrl.trim()
            ? {}
            : { slideUrl: editSlideUrl.trim() }),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu liên kết video và slide.');
      }

      setIsEditingMedia(false);
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi lưu media bài học:', error);
      setMediaError(error instanceof Error ? error.message : 'Không thể lưu liên kết video và slide.');
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleRemoveUploadedSlide = async () => {
    if (!activeLessonId || !window.confirm('Bạn muốn gỡ file PowerPoint của bài học này?')) return;
    setIsSavingMedia(true);
    setMediaError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLessonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slideUrl: '' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gỡ slide.');
      }
      setIsEditingMedia(false);
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi gỡ slide:', error);
      setMediaError(error instanceof Error ? error.message : 'Không thể gỡ slide.');
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleUploadSlide = async () => {
    if (!activeLessonId || !slideFile) return;
    setIsUploadingSlide(true);
    setMediaError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', slideFile);
      const response = await fetch(`http://localhost:5000/api/teacher/lesson/${activeLessonId}/slide`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải hoặc chuyển đổi slide.');
      }

      setSlideFile(null);
      setIsEditingMedia(false);
      const fileInput = document.getElementById('lesson-slide-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi tải slide bài học:', error);
      setMediaError(error instanceof Error ? error.message : 'Không thể tải hoặc chuyển đổi slide.');
    } finally {
      setIsUploadingSlide(false);
    }
  };

  const downloadSlideFile = async (url: string, fileName: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || 'Không thể tải tệp slide.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('Lỗi tải tệp slide:', error);
      setMediaError(error instanceof Error ? error.message : 'Không thể tải tệp slide.');
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
    if (type === 'course') {
      setNewCourseDescription('');
      setNewCourseCategoryId(categories[0] ? String(categories[0].id) : '');
    }
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

  const handleReorderContent = async (
    type: 'chapters' | 'lessons',
    parentId: number,
    itemIds: number[],
    index: number,
    offset: -1 | 1
  ) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= itemIds.length || isSavingOrder) return;
    const reorderedIds = [...itemIds];
    [reorderedIds[index], reorderedIds[nextIndex]] = [reorderedIds[nextIndex], reorderedIds[index]];

    setIsSavingOrder(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const endpoint = type === 'chapters'
        ? `/api/teacher/course/${parentId}/chapters/order`
        : `/api/teacher/chapter/${parentId}/lessons/order`;
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(type === 'chapters'
          ? { chapterIds: reorderedIds }
          : { lessonIds: reorderedIds }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật thứ tự nội dung.');
      }
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi sắp xếp nội dung khóa học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể cập nhật thứ tự nội dung.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const openCourseEditor = () => {
    if (!courseData) return;
    setCourseTitleInput(courseData.title);
    setCourseDescriptionInput(courseData.description);
    setCourseCategoryInput(String(courseData.categoryId));
    setIsCourseEditorOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!courseData) return;
    const categoryId = Number(courseCategoryInput);
    if (!courseTitleInput.trim() || courseTitleInput.trim().length > 200 || !Number.isSafeInteger(categoryId)) {
      window.alert('Vui lòng nhập tên khóa học hợp lệ và chọn danh mục.');
      return;
    }

    setIsSavingCourse(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teacher/course/${courseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: courseTitleInput.trim(),
          description: courseDescriptionInput,
          categoryId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật khóa học.');
      }
      setIsCourseEditorOpen(false);
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi cập nhật thông tin khóa học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể cập nhật khóa học.');
    } finally {
      setIsSavingCourse(false);
    }
  };

  const openCategoryModal = (mode: 'create' | 'edit') => {
    if (mode === 'edit') {
      const category = categories.find(item => item.id === selectedCategoryId);
      if (!category) return;
      setCategoryNameInput(category.name);
      setCategoryDescriptionInput(category.description || '');
    } else {
      setCategoryNameInput('');
      setCategoryDescriptionInput('');
    }
    setCategoryMode(mode);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    const name = categoryNameInput.trim();
    if (!name) {
      window.alert('Vui lòng nhập tên danh mục.');
      return;
    }

    setIsSavingCategory(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const isEdit = categoryMode === 'edit';
      const endpoint = isEdit ? `/api/teacher/categories/${selectedCategoryId}` : '/api/teacher/categories';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: categoryDescriptionInput.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu danh mục.');
      }
      if (!isEdit && payload.data?.id) {
        setSelectedCategoryId(payload.data.id);
      }
      setIsCategoryModalOpen(false);
      await fetchCategories();
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi lưu danh mục:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể lưu danh mục.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategoryId) return;
    const category = categories.find(item => item.id === selectedCategoryId);
    if (!window.confirm(`Xóa danh mục "${category?.name || ''}"? Thao tác này không thể hoàn tác.`)) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teacher/categories/${selectedCategoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xóa danh mục.');
      }
      setSelectedCategoryId(null);
      await fetchCategories();
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi xóa danh mục:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể xóa danh mục.');
    }
  };

  const handleToggleCourseVisibility = async () => {
    if (!courseData) return;
    const nextStatus = courseData.status === 'Published' ? 'Draft' : 'Published';
    const confirmation = nextStatus === 'Draft'
      ? 'Ẩn khóa học? Học viên, kể cả người đã ghi danh, sẽ không truy cập được nội dung khi khóa ở trạng thái Draft.'
      : 'Hiển thị khóa học cho học viên?';
    if (!window.confirm(confirmation)) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teacher/course/${courseData.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật trạng thái khóa học.');
      }
      await fetchCourseData();
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái khóa học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái khóa học.');
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseData || !window.confirm('Xóa khóa học và toàn bộ nội dung? Chỉ xóa được khi khóa chưa có ghi danh hoặc lịch sử học tập.')) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const response = await fetch(`http://localhost:5000/api/teacher/course/${courseData.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xóa khóa học.');
      }
      setCourseData(null);
      setActiveLessonId(null);
      setSelectedCourseId('');
      setCourseOptions(prev => prev.filter(item => item.id !== courseData.id));
    } catch (error) {
      console.error('Lỗi xóa khóa học:', error);
      window.alert(error instanceof Error ? error.message : 'Không thể xóa khóa học.');
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center">Đang tải...</div>;

  const safeCourseData: CourseData = courseData || {
    id: 0,
    title: 'Chưa có khóa học',
    description: '',
    categoryId: 0,
    categoryName: '',
    categories: [],
    status: 'Draft',
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
          {courseOptions.length > 0 && (
            <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setActiveLessonId(null);
              }}
              className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500"
              aria-label="Chọn khóa học"
            >
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          )}
          {courseData && (
            <>
              <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                courseData.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {courseData.status === 'Published' ? 'Đang hiển thị' : 'Đang ẩn'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleCourseVisibility()}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ${
                    courseData.status === 'Published'
                      ? 'bg-amber-50 text-amber-700 ring-amber-100 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100'
                  }`}
                >
                  {courseData.status === 'Published' ? 'Ẩn khóa học' : 'Hiện khóa học'}
                </button>
              </div>
            </>
          )}
          <div className="mt-3 flex items-end justify-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Danh mục</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => openCategoryModal('edit')} disabled={!selectedCategoryId} title="Sửa danh mục" aria-label="Sửa danh mục" className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <Pencil size={16} />
                  <span className="text-[9px] font-bold">Sửa</span>
                </button>
                <button type="button" onClick={() => void handleDeleteCategory()} disabled={!selectedCategoryId} title="Xóa danh mục" aria-label="Xóa danh mục" className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={16} />
                  <span className="text-[9px] font-bold">Xóa</span>
                </button>
              </div>
            </div>
            <span className="mb-1 h-10 w-px bg-gray-200" aria-hidden="true" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Khóa học</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={openCourseEditor} disabled={!courseData} title="Sửa khóa học" aria-label="Sửa khóa học" className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <Pencil size={16} />
                  <span className="text-[9px] font-bold">Sửa</span>
                </button>
                <button type="button" onClick={() => void handleDeleteCourse()} disabled={!courseData} title="Xóa khóa học" aria-label="Xóa khóa học" className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={16} />
                  <span className="text-[9px] font-bold">Xóa</span>
                </button>
              </div>
            </div>
          </div>
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
              {safeCourseData.chapters.map((chapter, chapterIndex) => {
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
                      <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          title="Chuyển chương lên"
                          aria-label={`Chuyển chương ${chapter.title} lên`}
                          disabled={isSavingOrder || chapterIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReorderContent(
                              'chapters',
                              safeCourseData.id,
                              safeCourseData.chapters.map((item) => item.id),
                              chapterIndex,
                              -1
                            );
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                        >↑</button>
                        <button
                          type="button"
                          title="Chuyển chương xuống"
                          aria-label={`Chuyển chương ${chapter.title} xuống`}
                          disabled={isSavingOrder || chapterIndex === safeCourseData.chapters.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReorderContent(
                              'chapters',
                              safeCourseData.id,
                              safeCourseData.chapters.map((item) => item.id),
                              chapterIndex,
                              1
                            );
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                        >↓</button>
                        <button onClick={(e) => { e.stopPropagation(); openModal('edit-chapter', chapter.id, null, chapter.title); }} className="p-1 hover:bg-blue-100 rounded text-blue-500 text-xs">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }} className="p-1 hover:bg-red-100 rounded text-red-500 text-xs">🗑️</button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="ml-5 mt-1 border-l-2 border-gray-100 pl-3 flex flex-col gap-1">
                        {chapter.lessons.map((lesson, lessonIndex) => (
                          <div 
                            key={lesson.id} 
                            onClick={() => handleSelectLesson(lesson.id)}
                            className={`group flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] rounded-md cursor-pointer transition-colors ${activeLessonId === lesson.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeLessonId === lesson.id ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                              <span className="truncate">{lesson.title}</span>
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${lesson.isDraft ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {lesson.isDraft ? 'Draft' : 'Published'}
                              </span>
                            </div>
                            <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                               <button
                                 type="button"
                                 title="Chuyển bài học lên"
                                 aria-label={`Chuyển bài học ${lesson.title} lên`}
                                 disabled={isSavingOrder || lessonIndex === 0}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   void handleReorderContent(
                                     'lessons',
                                     chapter.id,
                                     chapter.lessons.map((item) => item.id),
                                     lessonIndex,
                                     -1
                                   );
                                 }}
                                 className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                               >↑</button>
                               <button
                                 type="button"
                                 title="Chuyển bài học xuống"
                                 aria-label={`Chuyển bài học ${lesson.title} xuống`}
                                 disabled={isSavingOrder || lessonIndex === chapter.lessons.length - 1}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   void handleReorderContent(
                                     'lessons',
                                     chapter.id,
                                     chapter.lessons.map((item) => item.id),
                                     lessonIndex,
                                     1
                                   );
                                 }}
                                 className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                               >↓</button>
                               {lesson.isDraft && <button onClick={(e) => { e.stopPropagation(); openModal('edit-lesson', chapter.id, lesson.id, lesson.title); }} className="p-1 hover:bg-blue-200 rounded text-blue-600 text-[10px]">✏️</button>}
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
        
        
        {activeTab === 'lessons' && courseData && (
           <div className="p-4 border-t border-gray-100 bg-gray-50">
             <button onClick={() => openModal('chapter')} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
               + Thêm Chapter
             </button>
           </div>
        )}
      </div>

      {/* KHU VỰC NỘI DUNG CHÍNH (BÊN PHẢI) */}
      <div className="flex-1 bg-white overflow-y-auto p-8 relative">
        <div className="mb-6 flex justify-end gap-3">
          <button type="button" onClick={() => openCategoryModal('create')} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            <Plus size={16} />
            Thêm danh mục
          </button>
          <button type="button" onClick={() => openModal('course')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={16} />
            Tạo khóa học
          </button>
        </div>

        {!courseData ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">📂</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Chưa có khóa học nào</h2>
            <p className="text-gray-500 text-sm">Chọn <span className="font-semibold text-blue-600">Tạo khóa học</span> ở góc trên bên phải để bắt đầu.</p>
          </div>
        ) : activeTab === 'lessons' && !activeLesson ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">Chọn một bài học bên trái hoặc tạo bài học mới.</div>
        ) : activeTab === 'lessons' && activeLesson ? (
          <div className="max-w-4xl mx-auto pb-12">
            
            {/* Header Bài học */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${activeLesson.isDraft ? 'text-amber-700 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                    {activeLesson.isDraft ? 'Draft' : '✓ Published'}
                  </span>
                  <span className="text-xs font-medium text-blue-600">Bài học</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">{activeLesson.title}</h1>
              </div>
              <div className="flex gap-3">
              <button className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleLessonStatus()}
                    disabled={isUpdatingLessonStatus}
                    className={`px-4 py-2 font-bold rounded-lg disabled:opacity-60 ${activeLesson.isDraft ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                  >
                    {isUpdatingLessonStatus
                      ? 'Đang cập nhật...'
                      : activeLesson.isDraft ? 'Xuất bản bài học' : 'Chuyển về Draft để chỉnh sửa'}
                  </button>
              </div>
            </div>

            {!activeLesson.isDraft && (
              <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Bài học đã xuất bản và đang ở chế độ chỉ xem. Chuyển về Draft để sửa nội dung; học viên sẽ tạm thời không truy cập được.
              </p>
            )}

            <section className="mb-6 rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900">Thời lượng dự kiến</h3>
                  <p className="mt-1 text-xs text-gray-500">Thời lượng này được hiển thị cho học viên, tính bằng phút.</p>
                </div>
                {activeLesson.isDraft ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Thời lượng bài học tính bằng phút"
                      value={durationInput}
                      onChange={(event) => setDurationInput(event.target.value)}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-gray-600">phút</span>
                    <button
                      type="button"
                      onClick={() => void handleSaveDuration()}
                      disabled={isSavingDuration}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingDuration ? 'Đang lưu...' : 'Lưu'}
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-gray-700">
                    {activeLesson.durationMinutes > 0 ? `${activeLesson.durationMinutes} phút` : 'Chưa đặt'}
                  </span>
                )}
              </div>
            </section>

            <section className="mb-6 rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-bold text-gray-900">Học viên hoàn thành bài</h3>
              <p className="mt-1 text-sm text-gray-600">
                {activeLesson.completedStudentCount} học viên đã hoàn thành
              </p>
              {activeLesson.completedStudents.length > 0 ? (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {activeLesson.completedStudents.map((student) => (
                    <li key={student.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                        {student.name.slice(0, 1).toUpperCase()}
                      </span>
                      {student.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Chưa có học viên hoàn thành bài học này.</p>
              )}
            </section>

            <section className="mb-6 rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Video và tài liệu slide</h3>
                  <p className="mt-1 text-xs text-gray-500">Video YouTube/MP4 và slide PDF hoặc tải PPT/PPTX để chuyển thành PDF.</p>
                </div>
                {!isEditingMedia && activeLesson.isDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditVideoUrl(activeLesson.videoUrl);
                      setEditSlideUrl(activeLesson.slideOriginalUrl ? '' : activeLesson.slideUrl);
                      setMediaError('');
                      setIsEditingMedia(true);
                    }}
                    className="shrink-0 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                  >
                    {activeLesson.hasVideo || activeLesson.hasSlide ? 'Sửa liên kết' : 'Thêm liên kết'}
                  </button>
                ) : isEditingMedia ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMedia(false);
                        setMediaError('');
                      }}
                      disabled={isSavingMedia}
                      className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveMedia()}
                      disabled={isSavingMedia}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingMedia ? 'Đang lưu...' : 'Lưu'}
                    </button>
                  </div>
                ) : null}
              </div>

              {isEditingMedia ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Link video
                    <input
                      type="url"
                      maxLength={500}
                      value={editVideoUrl}
                      onChange={(event) => setEditVideoUrl(event.target.value)}
                      placeholder="YouTube URL hoặc link trực tiếp .mp4"
                      className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="mt-1 block text-xs font-normal text-gray-500">Để trống nếu bài học không có video. Link YouTube cần bật chế độ xem công khai/không công khai.</span>
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    Link slide PDF
                    {activeLesson.slideOriginalUrl && (
                      <span className="mt-1 block text-xs font-normal text-blue-700">
                        Bài học đang dùng PPT/PPTX đã tải lên. Để trống để giữ nguyên; tải file mới để thay thế.
                      </span>
                    )}
                    <input
                      type="url"
                      maxLength={500}
                      value={editSlideUrl}
                      onChange={(event) => setEditSlideUrl(event.target.value)}
                      disabled={Boolean(activeLesson.slideOriginalUrl)}
                      placeholder="Link PDF công khai"
                      className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    <span className="mt-1 block text-xs font-normal text-gray-500">Để trống nếu bài học không có slide; link cần mở được mà không cần đăng nhập.</span>
                  </label>
                  <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4">
                    <label htmlFor="lesson-slide-upload" className="block text-sm font-medium text-gray-700">
                      Hoặc tải PowerPoint lên để chuyển thành PDF
                    </label>
                    <input
                      id="lesson-slide-upload"
                      type="file"
                      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      onChange={(event) => {
                        setSlideFile(event.target.files?.[0] || null);
                        setMediaError('');
                      }}
                      className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-200"
                    />
                    <p className="mt-1 text-xs text-gray-500">Chấp nhận .ppt/.pptx, tối đa 25 MB. Upload sẽ thay slide hiện tại.</p>
                    {slideFile && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="break-all text-xs text-gray-600">{slideFile.name}</span>
                        <button
                          type="button"
                          onClick={() => void handleUploadSlide()}
                          disabled={isUploadingSlide || isSavingMedia}
                          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {isUploadingSlide ? 'Đang tải và chuyển PDF...' : 'Tải lên và chuyển PDF'}
                        </button>
                      </div>
                    )}
                  </div>
                  {mediaError && <p role="alert" className="text-sm text-red-600">{mediaError}</p>}
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    Video: {activeLesson.videoUrl
                      ? <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-blue-600 hover:underline">{activeLesson.videoUrl}</a>
                      : <span className="text-gray-400">Chưa thêm</span>}
                  </p>
                  <p className="text-gray-600">
                    Slide: {activeLesson.slideOriginalUrl
                      ? <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-700">Đã tải PPT/PPTX và chuyển PDF</span>
                          <button
                            type="button"
                            onClick={() => void downloadSlideFile(
                              activeLesson.slideOriginalUrl,
                              activeLesson.slideOriginalUrl.includes('.pptx') ? 'lesson-slide.pptx' : 'lesson-slide.ppt'
                            )}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            Tải file gốc
                          </button>
                          {activeLesson.isDraft && <button
                            type="button"
                            onClick={() => void handleRemoveUploadedSlide()}
                            className="font-semibold text-red-600 hover:underline"
                          >
                            Gỡ slide
                          </button>}
                        </span>
                      : activeLesson.slideUrl
                      ? <a href={activeLesson.slideUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-blue-600 hover:underline">{activeLesson.slideUrl}</a>
                      : <span className="text-gray-400">Chưa thêm</span>}
                  </p>
                </div>
              )}
            </section>

            {/* Khối 1: Mục tiêu học tập (Dữ liệu thật) */}
            <div className="border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Mục tiêu học tập</h3>
                {!isEditingObjectives ? (
                  activeLesson.isDraft ? (
                    <button
                      onClick={() => { setIsEditingObjectives(true); setEditObjectives([...activeLesson!.objectives]); }}
                      className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                    >
                      + Thêm / Sửa
                    </button>
                  ) : null
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
                  activeLesson.isDraft ? (
                    <button
                      onClick={() => { setIsEditingContent(true); setEditContentValue(activeLesson.content); }}
                      className="text-xs text-blue-600 font-medium hover:underline bg-blue-50 px-3 py-1.5 rounded-md flex items-center gap-1"
                    >
                      ✏️ Sửa nội dung
                    </button>
                  ) : null
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
                  activeLesson.isDraft ? (
                    <button
                      onClick={() => { setIsEditingCode(true); setEditCodeValue(activeLesson!.codeExample); }}
                      className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                    >
                      ✏️ Sửa code
                    </button>
                  ) : null
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
                {activeLesson.isDraft && <button onClick={() => openModal('exercise', null, activeLesson!.id)} className="text-xs text-blue-600 hover:underline font-medium">+ Thêm bài tập</button>}
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
          <QuizTab
            courseId={courseData?.id || 0}
            onAddQuiz={() => openModal('quiz', null, null)}
          />
          
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
      {isCourseEditorOpen && courseData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-editor-title"
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="course-editor-title" className="text-xl font-bold text-gray-900">Cập nhật khóa học</h2>
              <button
                type="button"
                onClick={() => setIsCourseEditorOpen(false)}
                disabled={isSavingCourse}
                aria-label="Đóng"
                className="text-xl text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >×</button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Tên khóa học
                <input
                  type="text"
                  maxLength={200}
                  value={courseTitleInput}
                  onChange={(event) => setCourseTitleInput(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Mô tả
                <textarea
                  rows={4}
                  value={courseDescriptionInput}
                  onChange={(event) => setCourseDescriptionInput(event.target.value)}
                  className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Danh mục
                <select
                  value={courseCategoryInput}
                  onChange={(event) => setCourseCategoryInput(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {courseData.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCourseEditorOpen(false)}
                disabled={isSavingCourse}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >Hủy</button>
              <button
                type="button"
                onClick={() => void handleSaveCourse()}
                disabled={isSavingCourse}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >{isSavingCourse ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
            </div>
          </section>
        </div>
      )}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="category-modal-title" className="text-xl font-bold text-gray-900">
                {categoryMode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={isSavingCategory}
                aria-label="Đóng"
                className="text-xl text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >×</button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Tên danh mục
                <input
                  type="text"
                  maxLength={100}
                  value={categoryNameInput}
                  onChange={(event) => setCategoryNameInput(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Mô tả
                <textarea
                  rows={4}
                  value={categoryDescriptionInput}
                  onChange={(event) => setCategoryDescriptionInput(event.target.value)}
                  className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={isSavingCategory}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >Hủy</button>
              <button
                type="button"
                onClick={() => void handleSaveCategory()}
                disabled={isSavingCategory}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >{isSavingCategory ? 'Đang lưu...' : 'Lưu dữ liệu'}</button>
            </div>
          </section>
        </div>
      )}
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

              {modalType === 'course' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Mô tả</label>
                    <textarea
                      rows={4}
                      value={newCourseDescription}
                      onChange={(e) => setNewCourseDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Danh mục</label>
                    <select
                      value={newCourseCategoryId}
                      onChange={(e) => setNewCourseCategoryId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-gray-800"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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