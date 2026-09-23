const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/authMiddleware');


const { getDashboardData, getCourseData, getProfileData } = require('../../controllers/student/studentController');

router.get('/dashboard', verifyToken, getDashboardData);
router.get('/courses', verifyToken, getCourseData);
router.get('/profile', verifyToken, getProfileData);

module.exports = router;