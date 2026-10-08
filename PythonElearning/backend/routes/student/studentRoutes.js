const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddleware');
const { getDashboardData, getCourseData, getProfileData, getLessonDetail, getExploreData, enrollCourse, getExerciseDetail, getAllExercises, executeCode, submitExercise } = require('../../controllers/student/studentController');

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
router.post('/execute', verifyToken, executeCode);
router.post('/submit-exercise', verifyToken, submitExercise);

module.exports = router;