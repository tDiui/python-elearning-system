const express = require('express');
const router = express.Router();

const { getDashboardData, getCourseData } = require('../../controllers/student/studentController');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.get('/dashboard', verifyToken, getDashboardData);
// THÊM ROUTE MỚI NÀY:
router.get('/courses', verifyToken, getCourseData);

module.exports = router;