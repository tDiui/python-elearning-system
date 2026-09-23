const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [user, stats, topicProgress, totalLessonsLearned, completedExercises, unreadNotifications] = await Promise.all([
      prisma.users.findUnique({
        where: { UserID: userId },
        select: { FullName: true }
      }),
      prisma.studentLearningStats.findMany({
        where: { UserID: userId }
      }),
      prisma.studentTopicProgress.findMany({
        where: { UserID: userId },
        include: {
          KnowledgeTopics: {
            select: { TopicName: true }
          }
        },
        orderBy: { LastUpdated: 'desc' }
      }),
      prisma.learningActivities.count({
        where: {
          UserID: userId,
          IsCompleted: true,
          LessonID: { not: null }
        }
      }),
      prisma.learningActivities.count({
        where: {
          UserID: userId,
          IsCompleted: true,
          ExerciseID: { not: null }
        }
      }),
      prisma.notifications.count({
        where: {
          UserID: userId,
          IsRead: false
        }
      })
    ]);

    const totalStudySeconds = stats.reduce((sum, item) => sum + (Number(item.TotalTimeSpentSeconds) || 0), 0);
    const averageScore = stats.length
      ? stats.reduce((sum, item) => sum + (Number(item.AverageScore) || 0), 0) / stats.length
      : 0;

    const knowledgeMap = topicProgress.map((item) => {
      const score = Math.min(Math.max(Number(item.AverageScore) || 0, 0), 100);
      return {
        name: item.KnowledgeTopics?.TopicName || 'Uncategorized Topic',
        score,
        color: score >= 70 ? 'bg-blue-600' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
      };
    });

    const dashboardData = {
      fullName: user?.FullName || 'Student',
      overallMastery: Number(averageScore.toFixed(2)),
      totalLessonsLearned: totalLessonsLearned || 0,
      avgScore: Number(averageScore.toFixed(2)),
      studyTimeHours: Number((totalStudySeconds / 3600).toFixed(1)),
      completedExercises: completedExercises || 0,
      notificationCount: unreadNotifications || 0,
      currentCourse: null,
      learningPath: [],
      aiInsight: null,
      knowledgeMap
    };

    res.status(200).json({ success: true, data: dashboardData });
  } catch (error) {
    console.error('Lỗi lấy data Dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Lấy dữ liệu chi tiết Khóa học đang học
const getCourseData = async (req, res) => {
  try {
    const userId = req.user.userId;

    // TODO: Truy vấn Prisma lấy Enrollments -> Courses -> Chapters -> Lessons
    // Vì hiện tại Database của bạn chưa có dữ liệu Khóa học, mình sẽ tạm thời mô phỏng 
    // trả về null để Frontend kích hoạt trạng thái "Trống" (Empty State).
    // Sau này khi có dữ liệu, bạn chỉ cần thay null bằng kết quả truy vấn Prisma.
    const courseData = null; 

    res.status(200).json({ success: true, data: courseData });
  } catch (error) {
    console.error('Lỗi lấy data Course:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Lấy dữ liệu Hồ sơ năng lực học tập
const getProfileData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const profileData = null;

    res.status(200).json({ success: true, data: profileData });
  } catch (error) {
    console.error('Lỗi lấy data Profile:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getDashboardData, getCourseData, getProfileData };