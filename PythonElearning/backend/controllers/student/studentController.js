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
// GET: LẤY DỮ LIỆU CHI TIẾT KHÓA HỌC MÀ SINH VIÊN ĐANG HỌC
const getCourseData = async (req, res) => {
  try {
    const studentId = req.user.userId;

    // 1. Tìm xem sinh viên đã được DUYỆT (Active) vào khóa học nào chưa
    const activeEnrollment = await prisma.enrollments.findFirst({
      where: {
        UserID: studentId,
        Status: 'Active'
      },
      include: {
        Courses: {
          include: {
            Users: { select: { FullName: true, Email: true } },
            Chapters: {
              orderBy: { ChapterID: 'asc' }, // Sắp xếp an toàn bằng ID
              include: {
                Lessons: {
                  orderBy: { LessonID: 'asc' }, // Sắp xếp an toàn bằng ID
                  select: {
                    LessonID: true,
                    Title: true,
                    DurationMinutes: true,
                    HasVideo: true,
                    HasArticle: true,
                    HasSlide: true,
                    Difficulty: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // 2. Nếu chưa có khóa học nào được duyệt, trả về null để Frontend hiện trang trống
    if (!activeEnrollment || !activeEnrollment.Courses) {
      return res.status(200).json({ success: true, data: null });
    }

    const course = activeEnrollment.Courses;

// 3. Tính toán tổng số bài học và định dạng cấu trúc Chapters
    let totalLessons = 0;
    let isFirstLesson = true; // Cờ đánh dấu bài đầu tiên

    const chaptersFormatted = course.Chapters.map(chapter => {
      const lessons = chapter.Lessons.map(lesson => {
        totalLessons++;
        
        // Logic xác định trạng thái bài học:
        let currentStatus = 'locked';
        if (isFirstLesson) {
          currentStatus = 'in-progress';
          isFirstLesson = false; // Đánh dấu là đã qua bài đầu tiên
        }

        return {
          id: lesson.LessonID,
          title: lesson.Title,
          duration: lesson.DurationMinutes ? `${lesson.DurationMinutes} phút` : "15 phút",
          status: currentStatus // Truyền biến (không có dấu nháy '')
        };
      });

      return {
        id: chapter.ChapterID,
        title: chapter.Title,
        completedLessons: 0,
        totalLessons: lessons.length,
        // Nếu chương có bài học đang mở, thì chương đó cũng mở
        status: lessons.length > 0 && lessons[0].status === 'in-progress' ? 'in-progress' : 'locked',
        lessons: lessons
      };
    });

    // 4. Format dữ liệu trả về ĐÚNG CẤU TRÚC mà Frontend mong đợi
    const courseData = {
      id: course.CourseID,
      title: course.Title,
      category: "Lập trình Python", 
      description: course.Description || "Mô tả khóa học đang được cập nhật...",
      instructorName: course.Users?.FullName || course.Users?.Email || "Chưa cập nhật",
      instructorAvatar: (course.Users?.FullName || course.Users?.Email || "GV").substring(0, 2).toUpperCase(),
      totalLessons: totalLessons,
      totalExercises: 0, 
      totalQuizzes: 0,   
      totalHours: "10",  
      progressPercent: activeEnrollment.ProgressPercent || 0,
      completedCount: 0,
      inProgressCount: 0,
      remainingCount: totalLessons,
      nextLesson: null, 
      chapters: chaptersFormatted
    };

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

// Lấy chi tiết bài học đang học
// Lấy chi tiết bài học đang học
const getLessonDetail = async (req, res) => {
  try {
    const lessonId = parseInt(req.query.id);
    
    if (!lessonId) {
      return res.status(400).json({ success: false, message: 'Thiếu ID bài học' });
    }

    // Kéo dữ liệu Lesson kèm theo Chapter và Exercises (Bài tập liên quan)
    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      include: {
        Chapters: { 
          select: { Title: true } 
        },
        Exercises: { // Kéo danh sách bài tập dựa vào LessonID
          select: {
            ExerciseID: true,
            Title: true,
            DifficultyLevel: true, 
            TimeLimitMinutes: true
          }
        }
      }
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Bài học không tồn tại' });
    }

    const data = {
      id: lesson.LessonID,
      title: lesson.Title,
      chapter: lesson.Chapters?.Title || "Chưa có chương",
      duration: lesson.DurationMinutes,
      difficulty: lesson.Difficulty || "Beginner",
      hasVideo: lesson.HasVideo,
      videoUrl: lesson.VideoUrl,
      hasArticle: lesson.HasArticle,
      articleContent: lesson.ArticleContent,
      // Đọc đúng tên cột trong file SQL của bạn:
      objectives: lesson.Objectives, 
      codeExample: lesson.CodeExample,
      // Map dữ liệu bài tập liên kết
      exercises: lesson.Exercises.map(ex => ({
        id: ex.ExerciseID,
        title: ex.Title,
        difficultyLevel: ex.DifficultyLevel, // SQL lưu kiểu số int
        timeLimit: ex.TimeLimitMinutes
      }))
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy chi tiết bài học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ==============================================================
// CÁC API MỚI CHO TÍNH NĂNG KHÁM PHÁ & ĐĂNG KÝ
// ==============================================================

// GET: LẤY DỮ LIỆU KHÁM PHÁ (GIẢNG VIÊN & KHÓA HỌC)
const getExploreData = async (req, res) => {
  try {
    // 1. Lấy danh sách Giảng viên (Kèm số lượng khóa học họ dạy)
    const instructors = await prisma.users.findMany({
      where: { Roles: { RoleName: 'Teacher' } }, // Lọc những user là Giảng viên
      select: {
        UserID: true,
        Email: true,
        FullName: true,
        _count: { select: { Courses: true } }
      }
    });

    // 2. Lấy danh sách Khóa học
    const courses = await prisma.courses.findMany({
      include: {
        Users: { select: { FullName: true, Email: true } } // Lấy tên người dạy
      }
    });

    // Format dữ liệu trả về cho Frontend
    res.status(200).json({
      success: true,
      data: {
        instructors: instructors.map(inst => ({
          id: inst.UserID,
          name: inst.FullName || inst.Email,
          courseCount: inst._count.Courses,
          title: "Giảng viên chuyên môn", 
          description: "Giúp người mới bắt đầu xây dựng nền tảng lập trình vững chắc qua thực hành."
        })),
        courses: courses.map(c => ({
          id: c.CourseID,
          title: c.Title,
          description: c.Description,
          instructor: c.Users?.FullName || c.Users?.Email || 'Chưa cập nhật',
          category: "Python cơ bản" 
        }))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu Explore:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST: SINH VIÊN GỬI YÊU CẦU ĐĂNG KÝ KHÓA HỌC
const enrollCourse = async (req, res) => {
  try {
    const studentId = req.user.userId; // Lấy ID sinh viên từ token
    const { courseId } = req.body;

    if (!courseId) return res.status(400).json({ success: false, message: 'Thiếu ID khóa học' });

    // Kiểm tra xem đã đăng ký chưa
    const existingEnrollment = await prisma.enrollments.findFirst({
      where: { UserID: studentId, CourseID: parseInt(courseId) }
    });

    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false, 
        message: existingEnrollment.Status === 'Pending' ? 'Bạn đã gửi yêu cầu rồi, đang chờ duyệt!' : 'Bạn đã có trong khóa học này!' 
      });
    }

    // Tạo record đăng ký mới với trạng thái Pending
    await prisma.enrollments.create({
      data: {
        UserID: studentId,
        CourseID: parseInt(courseId),
        Status: 'Pending',
        ProgressPercent: 0
      }
    });

    res.status(201).json({ success: true, message: 'Gửi yêu cầu đăng ký thành công! Vui lòng chờ giảng viên duyệt.' });
  } catch (error) {
    console.error('Lỗi đăng ký khóa học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { 
  getDashboardData, 
  getCourseData, 
  getProfileData, 
  getLessonDetail,
  getExploreData, // Export API mới
  enrollCourse    // Export API mới
};