const express = require('express');
const router = express.Router();
const { verifyToken, requireStudent } = require('../../middlewares/authMiddleware');
const { getDashboardData, getCourseData, getProfileData, getLessonDetail, getStudentLessonSlide, getExploreData, getExploreCourseDetail, getExploreEnrollmentStatus, recordLessonTime, completeLesson, enrollCourse, getExerciseDetail, getAllExercises, executeCode, submitExercise, getStudentQuizzes, getStudentQuiz, submitStudentQuiz, getStudentResults, getStudentQuizResultDetail, getStudentNotifications, markAllStudentNotificationsRead, markStudentNotificationRead } = require('../../controllers/student/studentController');
const { generateLearningPath } = require('../../controllers/student/learningPathController');

router.get('/dashboard', verifyToken, getDashboardData);
router.get('/courses', verifyToken, requireStudent, getCourseData);
router.get('/profile', verifyToken, getProfileData);
router.get('/learn', verifyToken, getLessonDetail);
router.get('/explore', getExploreData);
router.get('/explore/:id', getExploreCourseDetail);
router.get('/explore/:id/enrollment', verifyToken, requireStudent, getExploreEnrollmentStatus);
router.post('/enroll', verifyToken, requireStudent, enrollCourse);
router.post('/learning-path/generate', verifyToken, generateLearningPath);
// API lấy chi tiết bài học
router.get('/lesson', verifyToken, requireStudent, getLessonDetail);
router.get('/lesson/:id/slides/:format', verifyToken, requireStudent, getStudentLessonSlide);
router.post('/lesson/:id/time', verifyToken, requireStudent, recordLessonTime);
router.post('/lesson/:id/complete', verifyToken, requireStudent, completeLesson);
router.get('/exercise', verifyToken, requireStudent, getExerciseDetail);
router.get('/exercises', verifyToken, requireStudent, getAllExercises);
router.get('/quizzes', verifyToken, getStudentQuizzes);
router.get('/quiz/:id', verifyToken, getStudentQuiz);
router.post('/quiz/:id/submit', verifyToken, submitStudentQuiz);
router.get('/results', verifyToken, getStudentResults);
router.get('/results/:attemptId', verifyToken, getStudentQuizResultDetail);
router.get('/notifications', verifyToken, getStudentNotifications);
router.put('/notifications/read-all', verifyToken, markAllStudentNotificationsRead);
router.put('/notifications/:id/read', verifyToken, markStudentNotificationRead);
router.post('/execute', verifyToken, requireStudent, executeCode);
router.post('/submit-exercise', verifyToken, requireStudent, submitExercise);

module.exports = router;