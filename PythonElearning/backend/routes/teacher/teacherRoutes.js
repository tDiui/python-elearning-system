const express = require('express');
const router = express.Router();
const multer = require('multer');
const { MAX_SLIDE_SIZE, ALLOWED_EXTENSIONS, getSlideExtension } = require('../../utils/lessonSlides');
const { verifyToken, requireTeacher } = require('../../middlewares/authMiddleware');
const teacherAuth = [verifyToken, requireTeacher];
const { 
  getTeacherDashboard, getTeacherStudentProgress, getTeacherLayoutData, getTeacherCourseManagement,
  createCourse, updateCourse, updateCourseStatus, deleteCourse,
  getTeacherCategories, createTeacherCategory, updateTeacherCategory, deleteTeacherCategory,
  createChapter, createLesson, reorderChapters, reorderLessons,
  updateChapter, deleteChapter, updateLesson, updateLessonStatus, deleteLesson, createExercise, deleteExercise , getTeacherExercises, updateExerciseDetails, getTeacherQuizzes, createQuiz, getEnrollments, updateEnrollmentStatus
  , getEssayAttempts, gradeEssayAttempt, getNotificationCourses, getNotificationRecipients, sendCourseNotification
  , uploadLessonSlide, getTeacherLessonSlide,
  getTeacherQuizAttempts, getTeacherQuizAttemptDetail,
  getQuestionBank, createQuestionBankQuestion, updateQuestionBankQuestion, deleteQuestionBankQuestion,
  addStudentToCourse, removeStudentFromCourse
} = require('../../controllers/teacher/teacherController');

const slideUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SLIDE_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_EXTENSIONS.has(getSlideExtension(file.originalname))) {
      return callback(new Error('Chỉ chấp nhận tệp .ppt hoặc .pptx.'));
    }
    return callback(null, true);
  }
});
const handleSlideUpload = (req, res, next) => {
  slideUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Tệp slide không được vượt quá 25 MB.'
      : error.message || 'Không thể nhận tệp slide.';
    return res.status(400).json({ success: false, message });
  });
};

router.get('/dashboard', ...teacherAuth, getTeacherDashboard);
router.get('/courses/:courseId/students/:studentId/progress', ...teacherAuth, getTeacherStudentProgress);
router.get('/layout', ...teacherAuth, getTeacherLayoutData);
router.get('/course-management', ...teacherAuth, getTeacherCourseManagement);

router.get('/categories', ...teacherAuth, getTeacherCategories);
router.post('/categories', ...teacherAuth, createTeacherCategory);
router.put('/categories/:id', ...teacherAuth, updateTeacherCategory);
router.delete('/categories/:id', ...teacherAuth, deleteTeacherCategory);

router.post('/course', ...teacherAuth, createCourse);
router.put('/course/:id', ...teacherAuth, updateCourse);
router.patch('/course/:id/status', ...teacherAuth, updateCourseStatus);
router.delete('/course/:id', ...teacherAuth, deleteCourse);
router.post('/chapter', ...teacherAuth, createChapter);
router.post('/lesson', ...teacherAuth, createLesson);


router.put('/chapter/:id', ...teacherAuth, updateChapter);
router.delete('/chapter/:id', ...teacherAuth, deleteChapter);
router.put('/course/:id/chapters/order', ...teacherAuth, reorderChapters);
router.put('/chapter/:id/lessons/order', ...teacherAuth, reorderLessons);
router.put('/lesson/:id', ...teacherAuth, updateLesson);
router.patch('/lesson/:id/status', ...teacherAuth, updateLessonStatus);
router.post('/lesson/:id/slide', ...teacherAuth, handleSlideUpload, uploadLessonSlide);
router.get('/lesson/:id/slides/:format', ...teacherAuth, getTeacherLessonSlide);
router.delete('/lesson/:id', ...teacherAuth, deleteLesson);
router.post('/exercise', ...teacherAuth, createExercise);
router.delete('/exercise/:id', ...teacherAuth, deleteExercise);
router.get('/exercises', ...teacherAuth, getTeacherExercises);
router.put('/exercise/:id', ...teacherAuth, updateExerciseDetails);
router.get('/question-bank', ...teacherAuth, getQuestionBank);
router.post('/question-bank', ...teacherAuth, createQuestionBankQuestion);
router.put('/question-bank/:id', ...teacherAuth, updateQuestionBankQuestion);
router.delete('/question-bank/:id', ...teacherAuth, deleteQuestionBankQuestion);

router.get('/quizzes', ...teacherAuth, getTeacherQuizzes);
router.get('/quiz/:id/attempts', ...teacherAuth, getTeacherQuizAttempts);
router.get('/quiz/:id/attempts/:attemptId', ...teacherAuth, getTeacherQuizAttemptDetail);
router.post('/quiz', ...teacherAuth, createQuiz);

router.get('/enrollments', ...teacherAuth, getEnrollments);
router.post('/courses/:courseId/students', ...teacherAuth, addStudentToCourse);
router.delete('/enrollments/:id', ...teacherAuth, removeStudentFromCourse);
router.put('/enrollments/:id/status', ...teacherAuth, updateEnrollmentStatus);
router.get('/essay-attempts', ...teacherAuth, getEssayAttempts);
router.put('/essay-attempts/:attemptId/grade', ...teacherAuth, gradeEssayAttempt);
router.get('/notification-courses', ...teacherAuth, getNotificationCourses);
router.get('/notification-courses/:courseId/students', ...teacherAuth, getNotificationRecipients);
router.post('/notifications', ...teacherAuth, sendCourseNotification);


module.exports = router;