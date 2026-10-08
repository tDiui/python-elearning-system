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

// Lấy chi tiết bài tập
const getExerciseDetail = async (req, res) => {
  try {
    const exerciseId = parseInt(req.query.id);
    if (!exerciseId) return res.status(400).json({ success: false, message: 'Thiếu ID bài tập' });

    // Truy vấn bảng Exercises và kèm theo tên Topic (nếu có)
    const exercise = await prisma.exercises.findUnique({
      where: { ExerciseID: exerciseId },
      include: {
        KnowledgeTopics: { select: { TopicName: true } }
      }
    });

    if (!exercise) return res.status(404).json({ success: false, message: 'Bài tập không tồn tại' });

    // Parse TestCases JSON từ SQL Server (Giả định Giảng viên lưu dạng [{input: "...", expected: "..."}])
    let testCases = [];
    if (exercise.TestCases) {
      try { testCases = JSON.parse(exercise.TestCases); } catch (e) { console.error("Lỗi parse TestCases"); }
    }

    const data = {
      id: exercise.ExerciseID,
      title: exercise.Title,
      topicName: exercise.KnowledgeTopics?.TopicName || "General",
      type: exercise.Type || "Exercise",
      difficultyLevel: exercise.DifficultyLevel,
      content: exercise.Content || "Đề bài đang cập nhật",
      starterCode: exercise.StarterCode || "# Write your solution here\n\n",
      hints: exercise.Hints,
      testCases: testCases // Trả về mảng test cases để vẽ cột phải
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy bài tập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Lấy toàn bộ danh sách bài tập cho trang Thư viện
const getAllExercises = async (req, res) => {
  try {
      const exercises = await prisma.exercises.findMany({
      where: {
        Type: 'Practice'
      },
      include: {
        KnowledgeTopics: { select: { TopicName: true } }
      },
      orderBy: { DifficultyLevel: 'asc' } 
    });
    
    const data = exercises.map(ex => ({
      id: ex.ExerciseID,
      title: ex.Title,
      type: ex.Type || 'Coding',
      difficultyLevel: ex.DifficultyLevel,
      timeLimit: ex.TimeLimitMinutes,
      topicName: ex.KnowledgeTopics?.TopicName || 'General'
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy danh sách bài tập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// API Thực thi mã Python
const executeCode = async (req, res) => {
  const { code, testCases } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã nguồn' });
  }

  // 1. Tạo thư mục tạm để chứa file code nếu chưa có
  const tempDir = path.join(__dirname, '../../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 2. Tạo một file Python tạm thời với tên ngẫu nhiên
  const fileName = `script_${Date.now()}_${Math.floor(Math.random() * 1000)}.py`;
  const filePath = path.join(tempDir, fileName);

  try {
    // Ghi đoạn code của sinh viên vào file .py
    fs.writeFileSync(filePath, code);
    const results = [];

    // 3. Chạy vòng lặp test từng Test Case
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      
      const runTest = () => new Promise((resolve) => {
        // Gọi lệnh 'python' (hoặc 'python3' tùy hệ điều hành) để chạy file
        const pythonProcess = spawn('python', [filePath]);
        
        let output = '';
        let error = '';

        // Giới hạn thời gian chạy 3 giây để tránh lỗi vòng lặp vô hạn (Infinite Loop)
        const timeout = setTimeout(() => {
          pythonProcess.kill();
          resolve({ status: 'Error', actual: 'Timeout: Chạy quá 3 giây', passed: false });
        }, 3000);

        // Truyền Input vào (nếu Test case có Input)
        if (tc.input) {
          pythonProcess.stdin.write(tc.input + '\n');
          pythonProcess.stdin.end();
        }

        // Lấy dữ liệu in ra màn hình (Output)
        pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

        // Khi chạy xong
        pythonProcess.on('close', (exitCode) => {
          clearTimeout(timeout);
          if (error) {
            resolve({ status: 'Error', actual: error.trim(), passed: false });
          } else {
            const actualOutput = output.trim();
            const expectedOutput = tc.expected ? tc.expected.trim() : '';
            const passed = actualOutput === expectedOutput;
            resolve({ status: passed ? 'Pass' : 'Fail', actual: actualOutput, passed });
          }
        });
      });

      const result = await runTest();
      results.push({ ...tc, ...result }); // Gộp kết quả chạy vào test case ban đầu
    }

    // 4. Xóa file tạm sau khi chạy xong để dọn dẹp bộ nhớ
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.status(200).json({ success: true, results });

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Lỗi quá trình chạy code:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi chạy code' });
  }
};

// Lưu kết quả nộp bài tập chuẩn theo Database PythonElearning
const submitExercise = async (req, res) => {
  try {
    // 1. LẤY ID NGƯỜI DÙNG TỪ TOKEN
    const studentId = req.user?.id || req.user?.UserID || req.user?.userId || req.userId;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Lỗi xác thực: Không tìm thấy ID học viên.' });
    }

    const { exerciseId, courseId, code, isPassed } = req.body;

    if (!exerciseId || !courseId || !code) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu nộp bài.' });
    }

    const exIdInt = parseInt(exerciseId);
    const cIdInt = parseInt(courseId);

    // 2. LẤY THÔNG TIN BÀI TẬP VÀ XỬ LÝ KHÓA NGOẠI (TOPIC_ID)
    const exercise = await prisma.exercises.findUnique({
      where: { ExerciseID: exIdInt },
      select: {
        MaxScore: true,
        TopicID: true,
        Lessons: {
          select: {
            Title: true,
            Chapters: { select: { Title: true } }
          }
        }
      }
    });
    
    const scoreEarned = isPassed ? (exercise?.MaxScore || 10) : 0;

    // 3. XỬ LÝ LỖI KHÓA NGOẠI TẬN GỐC (TỰ TẠO TOPIC NẾU THIẾU)
    let validTopicId = exercise?.TopicID;
    
    if (!validTopicId) {
      // Tìm thử xem có Topic nào trong DB không
      let fallbackTopic = await prisma.knowledgeTopics.findFirst({
         where: { CourseID: cIdInt } // Ưu tiên tìm Topic của khóa học hiện tại
      });

      // NẾU KHÔNG CÓ TOPIC NÀO TRONG DATABASE -> TỰ TẠO 1 TOPIC MỚI
      if (!fallbackTopic) {
         fallbackTopic = await prisma.knowledgeTopics.create({
            data: {
               CourseID: cIdInt,
               TopicName: (exercise?.Lessons?.Chapters?.Title || "General Programming (Auto-generated)").slice(0, 150),
               Description: exercise?.Lessons?.Title || "Chủ đề tự động tạo cho các bài tập thực hành Code."
            }
         });
      }
      validTopicId = fallbackTopic.TopicID;
    }

    // 4. TRANSACTION GHI DỮ LIỆU
    const result = await prisma.$transaction(async (prisma) => {
      
      // BƯỚC 1: Tạo TestAttempt
      const attempt = await prisma.testAttempts.create({
        data: {
          UserID: studentId,
          ExerciseID: exIdInt,
          StartTime: new Date(),
          EndTime: new Date(),
          TotalScore: scoreEarned
        }
      });

      // BƯỚC 2: Tìm hoặc tạo Question giả
      let firstQuestion = await prisma.testQuestions.findFirst({
        where: { ExerciseID: exIdInt }
      });

      if (!firstQuestion) {
        firstQuestion = await prisma.testQuestions.create({
          data: {
            ExerciseID: exIdInt,
            TopicID: validTopicId, // Đảm bảo 100% có TopicID hợp lệ
            Content: "Coding Challenge",
            Points: exercise?.MaxScore || 10
          }
        });
      }

      // BƯỚC 3: Lưu mã code vào Submissions
      await prisma.submissions.create({
        data: {
          AttemptID: attempt.AttemptID,
          QuestionID: firstQuestion.QuestionID,
          CodeSubmitted: code,
          IsCorrect: isPassed,
          ScoreEarned: scoreEarned
        }
      });

      // BƯỚC 4: Ghi nhận hoạt động vào LearningActivities
      await prisma.learningActivities.create({
        data: {
          UserID: studentId,
          CourseID: cIdInt,
          ExerciseID: exIdInt,
          ActionType: 'Submit Code',
          TimeSpentSeconds: 0,
          Score: scoreEarned,
          IsCompleted: isPassed,
          CreatedAt: new Date()
        }
      });

      return attempt;
    });

    res.status(200).json({ success: true, message: 'Đã lưu kết quả thành công', data: result });
  } catch (error) {
    console.error('Lỗi lưu nộp bài:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu bài' });
  }
};

module.exports = { 
  getDashboardData, 
  getCourseData, 
  getProfileData, 
  getAllExercises,
  getLessonDetail,
  getExploreData,
  enrollCourse,
  getExerciseDetail,
  executeCode,
  submitExercise,    
};