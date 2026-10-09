const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddleware');
const { getDashboardData, getCourseData, getProfileData, getLessonDetail, getExploreData, enrollCourse, getExerciseDetail, getAllExercises, executeCode, submitExercise, getStudentQuizzes, getStudentQuiz, submitStudentQuiz, getStudentResults, getStudentQuizResultDetail, getStudentNotifications, markAllStudentNotificationsRead, markStudentNotificationRead } = require('../../controllers/student/studentController');

router.get('/dashboard', verifyToken, getDashboardData);
router.get('/courses', verifyToken, getCourseData);
router.get('/profile', verifyToken, getProfileData);
router.get('/learn', verifyToken, getLessonDetail);
router.get('/explore', verifyToken, getExploreData);
router.post('/enroll', verifyToken, enrollCourse);
// API lấy chi tiết bài học
router.get('/lesson', verifyToken, getLessonDetail);
router.get('/exercise', verifyToken, getExerciseDetail);
router.get('/exercises', verifyToken, getAllExercises);
router.get('/quizzes', verifyToken, getStudentQuizzes);
router.get('/quiz/:id', verifyToken, getStudentQuiz);
router.post('/quiz/:id/submit', verifyToken, submitStudentQuiz);
router.get('/results', verifyToken, getStudentResults);
router.get('/results/:attemptId', verifyToken, getStudentQuizResultDetail);
router.get('/notifications', verifyToken, getStudentNotifications);
router.put('/notifications/read-all', verifyToken, markAllStudentNotificationsRead);
router.put('/notifications/:id/read', verifyToken, markStudentNotificationRead);
router.post('/execute', verifyToken, executeCode);
router.post('/submit-exercise', verifyToken, submitExercise);

module.exports = router;