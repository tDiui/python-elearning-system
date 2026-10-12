const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../../middlewares/authMiddleware');
const { getAdminDashboard } = require('../../controllers/admin/dashboardController');
const {
  getUsers,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser
} = require('../../controllers/admin/userController');
const {
  getManagementData,
  createCategory,
  updateCategory,
  deleteCategory,
  createCourse,
  updateCourse,
  updateCourseStatus,
  updateCourseLock,
  deleteCourse
} = require('../../controllers/admin/courseController');
const { getAnalytics } = require('../../controllers/admin/analyticsController');
const { getSystemSettings, updateSystemSettings } = require('../../controllers/admin/settingsController');

router.get('/dashboard', verifyToken, getAdminDashboard);
router.use(verifyToken, requireAdmin);
router.get('/analytics', getAnalytics);
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.get('/courses', getManagementData);
router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.patch('/courses/:id/status', updateCourseStatus);
router.patch('/courses/:id/lock', updateCourseLock);
router.delete('/courses/:id', deleteCourse);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

module.exports = router;
