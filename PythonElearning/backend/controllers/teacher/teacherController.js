const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. HÀM LẤY DỮ LIỆU DASHBOARD
const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Lấy thông tin khóa học đầu tiên do giảng viên này tạo
    const course = await prisma.courses.findFirst({
      where: { InstructorID: teacherId },
      include: {
        _count: {
          select: { Enrollments: true } // Đếm tổng số sinh viên
        }
      }
    });

    if (!course) {
      return res.status(200).json({ success: true, data: null });
    }

    // Đếm số đơn đăng ký đang chờ duyệt
    const pendingApprovals = await prisma.enrollments.count({
      where: { 
        CourseID: course.CourseID,
        Status: 'Pending' 
      }
    });

    // Đếm số sinh viên đang Active
    const activeStudents = await prisma.enrollments.count({
      where: { 
        CourseID: course.CourseID,
        Status: 'Active' 
      }
    });

    const data = {
      courseName: course.Title,
      totalStudentsClass: course._count.Enrollments,
      stats: {
        totalStudents: course._count.Enrollments,
        activeStudents: activeStudents,
        courseCompletion: 0,
        avgScore: 0,
      },
      pendingApprovals: pendingApprovals,
      gradeDistribution: [
        { range: '0-40', count: 0, height: '0%' },
        { range: '41-60', count: 0, height: '0%' },
        { range: '61-75', count: 0, height: '0%' },
        { range: '76-90', count: 0, height: '0%' },
        { range: '91-100', count: 0, height: '0%' },
      ],
      hardTopics: [],
      students: []
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu Teacher Dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// 2. HÀM LẤY DỮ LIỆU LAYOUT (SIDEBAR/TOPBAR)
const getTeacherLayoutData = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.users.findUnique({
      where: { UserID: userId },
      select: { FullName: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const unreadNotiCount = await prisma.notifications.count({
      where: { UserID: userId, IsRead: false }
    });

    res.status(200).json({
      success: true,
      data: {
        fullName: user.FullName,
        notificationCount: unreadNotiCount
      }
    });
  } catch (error) {
    console.error('Lỗi lấy layout data:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getTeacherDashboard, getTeacherLayoutData };