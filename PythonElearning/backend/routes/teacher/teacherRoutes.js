const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddleware');
const { 
  getTeacherDashboard, getTeacherLayoutData, getTeacherCourseManagement,
  createCourse, createChapter, createLesson,
  updateChapter, deleteChapter, updateLesson, deleteLesson, createExercise, deleteExercise , getTeacherExercises, updateExerciseDetails, getTeacherQuizzes, createQuiz
} = require('../../controllers/teacher/teacherController');

router.get('/dashboard', verifyToken, getTeacherDashboard);
router.get('/layout', verifyToken, getTeacherLayoutData);
router.get('/course-management', verifyToken, getTeacherCourseManagement);

router.post('/course', verifyToken, createCourse);
router.post('/chapter', verifyToken, createChapter);
router.post('/lesson', verifyToken, createLesson);


router.put('/chapter/:id', verifyToken, updateChapter);
router.delete('/chapter/:id', verifyToken, deleteChapter);
router.put('/lesson/:id', verifyToken, updateLesson);
router.delete('/lesson/:id', verifyToken, deleteLesson);
router.post('/exercise', verifyToken, createExercise);
router.delete('/exercise/:id', verifyToken, deleteExercise);
router.get('/exercises', verifyToken, getTeacherExercises);
router.put('/exercise/:id', verifyToken, updateExerciseDetails);

router.get('/quizzes', verifyToken, getTeacherQuizzes);
router.post('/quiz', verifyToken, createQuiz);
module.exports = router;