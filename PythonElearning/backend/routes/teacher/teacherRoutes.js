const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddleware');
const { getTeacherDashboard, getTeacherLayoutData } = require('../../controllers/teacher/teacherController');

router.get('/dashboard', verifyToken, getTeacherDashboard);
router.get('/layout', verifyToken, getTeacherLayoutData);

module.exports = router;