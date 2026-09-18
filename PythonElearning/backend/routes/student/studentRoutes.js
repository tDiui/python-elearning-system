const express = require('express');
const router = express.Router();

// Trỏ đúng về thư mục controllers/student và middlewares
const { getDashboardData } = require('../../controllers/student/studentController');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.get('/dashboard', verifyToken, getDashboardData);

module.exports = router;