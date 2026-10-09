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

const getStudentQuizzes = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const enrollments = await prisma.enrollments.findMany({
      where: { UserID: studentId, Status: 'Active' },
      select: { CourseID: true }
    });
    const courseIds = enrollments.map((enrollment) => enrollment.CourseID);

    if (!courseIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const quizzes = await prisma.exercises.findMany({
      where: {
        Type: 'Quiz',
        Status: 'Published',
        Lessons: { Chapters: { CourseID: { in: courseIds } } }
      },
      select: {
        ExerciseID: true,
        Title: true,
        TimeLimitMinutes: true,
        QuizConfig: true,
        Lessons: {
          select: {
            Chapters: {
              select: {
                Title: true,
                Courses: { select: { Title: true } }
              }
            }
          }
        }
      },
      orderBy: { ExerciseID: 'asc' }
    });

    const attemptCounts = quizzes.length
      ? await prisma.testAttempts.groupBy({
          by: ['ExerciseID'],
          where: { ExerciseID: { in: quizzes.map((quiz) => quiz.ExerciseID) } },
          _count: { _all: true }
        })
      : [];
    const attemptsByQuiz = new Map(
      attemptCounts.map((item) => [item.ExerciseID, item._count._all])
    );

    const data = quizzes.map((quiz) => {
      const config = quiz.QuizConfig ? JSON.parse(quiz.QuizConfig) : {};
      const questions = Array.isArray(config.questions) ? config.questions : [];
      const tags = Array.isArray(config.tags)
        ? config.tags.filter((tag) => typeof tag === 'string' && tag.trim())
        : [];

      return {
        id: quiz.ExerciseID,
        title: quiz.Title,
        courseName: quiz.Lessons?.Chapters?.Courses?.Title || '',
        chapterName: quiz.Lessons?.Chapters?.Title || '',
        tags,
        questionCount: questions.length,
        timeLimit: quiz.TimeLimitMinutes,
        passScore: typeof config.passScore === 'number' && Number.isFinite(config.passScore) ? config.passScore : null,
        maxScore: 10,
        attemptCount: attemptsByQuiz.get(quiz.ExerciseID) || 0
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy danh sách bài kiểm tra học viên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getStudentQuiz = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const quizId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài kiểm tra không hợp lệ' });
    }

    const enrollments = await prisma.enrollments.findMany({
      where: { UserID: studentId, Status: 'Active' },
      select: { CourseID: true }
    });
    const courseIds = enrollments.map((enrollment) => enrollment.CourseID);

    if (!courseIds.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài kiểm tra' });
    }

    const quiz = await prisma.exercises.findFirst({
      where: {
        ExerciseID: quizId,
        Type: 'Quiz',
        Status: 'Published',
        Lessons: { Chapters: { CourseID: { in: courseIds } } }
      },
      select: {
        ExerciseID: true,
        Title: true,
        TimeLimitMinutes: true,
        QuizConfig: true,
        Lessons: {
          select: {
            Chapters: {
              select: {
                Title: true,
                Courses: { select: { Title: true } }
              }
            }
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài kiểm tra' });
    }

    const config = quiz.QuizConfig ? JSON.parse(quiz.QuizConfig) : {};
    const questions = Array.isArray(config.questions) ? config.questions : [];

    res.status(200).json({
      success: true,
      data: {
        id: quiz.ExerciseID,
        title: quiz.Title,
        courseName: quiz.Lessons?.Chapters?.Courses?.Title || '',
        chapterName: quiz.Lessons?.Chapters?.Title || '',
        timeLimit: quiz.TimeLimitMinutes,
        maxScore: 10,
        passScore: typeof config.passScore === 'number' && Number.isFinite(config.passScore) ? config.passScore : null,
        questions: questions.map((question) => ({
          id: String(question.id),
          type: question.type,
          text: question.text,
          points: Number(question.points) || 0,
          options: Array.isArray(question.options)
            ? question.options.map((option) => ({
                id: String(option.id),
                text: option.text
              }))
            : []
        }))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết bài kiểm tra học viên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const submitStudentQuiz = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const quizId = Number.parseInt(req.params.id, 10);
    const { answers } = req.body;

    if (!Number.isInteger(quizId) || quizId <= 0 || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu nộp bài không hợp lệ' });
    }

    const enrollments = await prisma.enrollments.findMany({
      where: { UserID: studentId, Status: 'Active' },
      select: { CourseID: true }
    });
    const courseIds = enrollments.map((enrollment) => enrollment.CourseID);

    const quiz = courseIds.length
      ? await prisma.exercises.findFirst({
          where: {
            ExerciseID: quizId,
            Type: 'Quiz',
            Status: 'Published',
            Lessons: { Chapters: { CourseID: { in: courseIds } } }
          },
          select: {
            ExerciseID: true,
            LessonID: true,
            TopicID: true,
            MaxScore: true,
            QuizConfig: true,
            Lessons: {
              select: {
                Title: true,
                Chapters: { select: { CourseID: true, Title: true } },
                LessonTopics: { select: { TopicID: true } }
              }
            }
          }
        })
      : null;

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài kiểm tra' });
    }

    const config = quiz.QuizConfig ? JSON.parse(quiz.QuizConfig) : {};
    const questions = Array.isArray(config.questions) ? config.questions : [];

    if (!questions.length) {
      return res.status(409).json({ success: false, message: 'Bài kiểm tra chưa có câu hỏi' });
    }

    const answersByQuestion = new Map(
      answers.map((answer) => [String(answer.questionId), answer.value])
    );
    const questionIds = questions.map((question) => String(question.id));

    if (
      answersByQuestion.size !== answers.length ||
      answersByQuestion.size !== questions.length ||
      questionIds.some((questionId) => !answersByQuestion.has(questionId)) ||
      new Set(questionIds).size !== questionIds.length
    ) {
      return res.status(400).json({ success: false, message: 'Vui lòng trả lời đầy đủ câu hỏi' });
    }

    let pointsEarned = 0;
    let totalPoints = 0;
    const gradedAnswers = [];

    for (const question of questions) {
      const answer = answersByQuestion.get(String(question.id));
      const points = Number(question.points);
      if (!Number.isFinite(points) || points < 0) {
        return res.status(409).json({ success: false, message: 'Cấu hình điểm của bài kiểm tra không hợp lệ' });
      }

      totalPoints += points;
      let isCorrect = false;
      let selectedAnswerContent = null;

      if (question.type === 'multipleChoice') {
        const selectedOption = answer === null
          ? null
          : Array.isArray(question.options)
          ? question.options.find((option) => String(option.id) === String(answer))
          : null;
        if (answer !== null && !selectedOption) {
          return res.status(400).json({ success: false, message: 'Đáp án gửi lên không hợp lệ' });
        }
        isCorrect = selectedOption?.isCorrect === true;
        selectedAnswerContent = selectedOption?.text ?? null;
      } else if (question.type === 'trueFalse') {
        if (answer !== null && typeof answer !== 'boolean') {
          return res.status(400).json({ success: false, message: 'Đáp án đúng/sai không hợp lệ' });
        }
        if (typeof question.correctAnswer !== 'boolean') {
          return res.status(400).json({ success: false, message: 'Đáp án đúng/sai không hợp lệ' });
        }
        isCorrect = answer === question.correctAnswer;
        selectedAnswerContent = answer;
      } else if (question.type === 'fillIn') {
        if (answer !== null && typeof answer !== 'string') {
          return res.status(400).json({ success: false, message: 'Đáp án điền vào không hợp lệ' });
        }
        if (typeof question.correctAnswer !== 'string') {
          return res.status(400).json({ success: false, message: 'Đáp án điền vào không hợp lệ' });
        }
        isCorrect = typeof answer === 'string' &&
          answer.trim().toLocaleLowerCase() === question.correctAnswer.trim().toLocaleLowerCase();
        selectedAnswerContent = answer;
      } else if (question.type === 'essay') {
        if (answer !== null && typeof answer !== 'string') {
          return res.status(400).json({ success: false, message: 'Câu trả lời tự luận không hợp lệ' });
        }
        selectedAnswerContent = answer;
      } else {
        return res.status(409).json({ success: false, message: 'Bài kiểm tra có loại câu hỏi chưa được hỗ trợ' });
      }

      if (isCorrect) pointsEarned += points;
      gradedAnswers.push({
        question,
        answer,
        isCorrect,
        pointsEarned: isCorrect ? points : 0,
        selectedAnswerContent
      });
    }

    if (totalPoints <= 0) {
      return res.status(409).json({ success: false, message: 'Bài kiểm tra chưa có tổng điểm hợp lệ' });
    }

    const percentage = Number(((pointsEarned / totalPoints) * 100).toFixed(2));
    const maxScore = 10;
    const scoreEarned = Number(((maxScore * percentage) / 100).toFixed(2));
    const hasEssay = gradedAnswers.some((item) => item.question.type === 'essay');
    const passScore = typeof config.passScore === 'number' && Number.isFinite(config.passScore)
      ? config.passScore
      : null;
    const passed = passScore !== null
      ? percentage >= passScore
      : false;
    const submittedAt = new Date();
    const courseId = quiz.Lessons?.Chapters?.CourseID;

    if (!courseId || !courseIds.includes(courseId)) {
      return res.status(409).json({ success: false, message: 'Không xác định được khóa học của bài kiểm tra' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let topicId = quiz.TopicID || quiz.Lessons?.LessonTopics[0]?.TopicID;

      if (!topicId) {
        const topic = await tx.knowledgeTopics.findFirst({
          where: { CourseID: courseId },
          select: { TopicID: true }
        });
        topicId = topic?.TopicID;
      }

      if (!topicId) {
        const topic = await tx.knowledgeTopics.create({
          data: {
            CourseID: courseId,
            TopicName: (quiz.Lessons?.Chapters?.Title || 'General Programming').slice(0, 150),
            Description: quiz.Lessons?.Title || 'Chủ đề của bài kiểm tra'
          },
          select: { TopicID: true }
        });
        topicId = topic.TopicID;
      }

      const questionSubmissions = [];
      const usedQuestionIds = new Set();
      const questionRecords = await tx.testQuestions.findMany({
        where: { ExerciseID: quiz.ExerciseID },
        include: { Answers: { select: { AnswerID: true, Content: true, IsCorrect: true } } },
        orderBy: { QuestionID: 'asc' }
      });

      for (const item of gradedAnswers) {
        const question = item.question;
        const questionData = {
          Content: String(question.text || ''),
          QuestionType: question.type,
          Points: Number(question.points),
          TopicID: topicId
        };
        let databaseQuestion = questionRecords.find((record) =>
          !usedQuestionIds.has(record.QuestionID) &&
          record.Content === questionData.Content &&
          record.QuestionType === questionData.QuestionType &&
          Number(record.Points) === questionData.Points
        );

        if (!databaseQuestion) {
          databaseQuestion = await tx.testQuestions.create({
            data: {
              ExerciseID: quiz.ExerciseID,
              ...questionData
            },
            include: { Answers: { select: { AnswerID: true, Content: true, IsCorrect: true } } }
          });
          questionRecords.push(databaseQuestion);
        }
        usedQuestionIds.add(databaseQuestion.QuestionID);

        const answerEntries = question.type === 'multipleChoice'
          ? (Array.isArray(question.options) ? question.options : []).map((option) => ({
              key: String(option.id),
              content: String(option.text || ''),
              isCorrect: option.isCorrect === true
            }))
          : question.type === 'trueFalse'
            ? [
                { key: 'true', content: 'Đúng', isCorrect: question.correctAnswer === true },
                { key: 'false', content: 'Sai', isCorrect: question.correctAnswer === false }
              ]
            : question.type === 'fillIn'
              ? [{ key: 'correct', content: String(question.correctAnswer), isCorrect: true }]
              : [];
        const usedAnswerIds = new Set();
        const databaseAnswerIds = new Map();

        for (const entry of answerEntries) {
          let savedAnswer = databaseQuestion.Answers.find((existingAnswer) =>
            !usedAnswerIds.has(existingAnswer.AnswerID) &&
            existingAnswer.Content === entry.content &&
            existingAnswer.IsCorrect === entry.isCorrect
          );
          if (!savedAnswer) {
            savedAnswer = await tx.answers.create({
              data: {
                QuestionID: databaseQuestion.QuestionID,
                Content: entry.content,
                IsCorrect: entry.isCorrect
              },
              select: { AnswerID: true }
            });
            databaseQuestion.Answers.push({
              ...savedAnswer,
              Content: entry.content,
              IsCorrect: entry.isCorrect
            });
          }
          usedAnswerIds.add(savedAnswer.AnswerID);
          databaseAnswerIds.set(entry.key, savedAnswer.AnswerID);
        }

        let selectedAnswerId = null;
        if (question.type === 'multipleChoice' && item.answer !== null) {
          selectedAnswerId = databaseAnswerIds.get(String(item.answer));
        } else if (question.type === 'trueFalse' && item.answer !== null) {
          selectedAnswerId = databaseAnswerIds.get(String(item.answer));
        }

        questionSubmissions.push({
          QuestionID: databaseQuestion.QuestionID,
          SelectedAnswerID: selectedAnswerId || null,
          CodeSubmitted: JSON.stringify({
            question: String(question.text || ''),
            type: question.type,
            answer: item.selectedAnswerContent
          }),
          IsCorrect: item.isCorrect,
          ScoreEarned: item.pointsEarned
        });
      }

      await tx.exercises.update({
        where: { ExerciseID: quiz.ExerciseID },
        data: { MaxScore: maxScore, TopicID: topicId }
      });

      const attempt = await tx.testAttempts.create({
        data: {
          UserID: studentId,
          ExerciseID: quiz.ExerciseID,
          StartTime: submittedAt,
          EndTime: submittedAt,
          TotalScore: scoreEarned,
          GradingStatus: hasEssay ? 'Pending' : 'Published'
        }
      });

      for (const submission of questionSubmissions) {
        await tx.submissions.create({
          data: {
            AttemptID: attempt.AttemptID,
            ...submission
          }
        });
      }

      await tx.learningActivities.create({
        data: {
          UserID: studentId,
          CourseID: courseId,
          LessonID: quiz.LessonID,
          ExerciseID: quiz.ExerciseID,
          ActionType: 'Submit Quiz',
          TimeSpentSeconds: 0,
          Score: scoreEarned,
          IsCompleted: true,
          CreatedAt: submittedAt
        }
      });

      return attempt;
    });

    res.status(200).json({
      success: true,
      data: {
        attemptId: result.AttemptID,
        pendingReview: hasEssay,
        ...(hasEssay ? {} : {
          pointsEarned,
          totalPoints,
          percentage,
          maxScore,
          scoreEarned,
          passScore,
          passed
        })
      }
    });
  } catch (error) {
    console.error('Lỗi nộp bài kiểm tra học viên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getStudentResults = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const attempts = await prisma.testAttempts.findMany({
      where: { UserID: studentId },
      include: {
        Exercises: {
          select: {
            Title: true,
            Type: true,
            MaxScore: true,
            QuizConfig: true,
            Lessons: {
              select: {
                Title: true,
                Chapters: {
                  select: {
                    Title: true,
                    Courses: { select: { Title: true } }
                  }
                }
              }
            }
          }
        },
        Submissions: { select: { IsCorrect: true } }
      },
      orderBy: { StartTime: 'desc' }
    });

    const results = attempts.map((attempt) => {
      const exercise = attempt.Exercises;
      const isQuiz = exercise.Type === 'Quiz';
      const gradingStatus = isQuiz ? attempt.GradingStatus : null;
      const awaitingEssayGrade = isQuiz && ['Pending', 'Draft'].includes(gradingStatus);
      const configuredMaxScore = Number(exercise.MaxScore) || 10;
      const rawScore = Number(attempt.TotalScore) || 0;
      const isLegacyHundredPointQuiz = isQuiz && rawScore > 10;
      const maxScore = isQuiz ? 10 : configuredMaxScore;
      const score = awaitingEssayGrade ? null : isLegacyHundredPointQuiz
        ? Number((rawScore / 10).toFixed(2))
        : rawScore;
      const percentage = awaitingEssayGrade ? null : isLegacyHundredPointQuiz
        ? Math.min(rawScore, 100)
        : maxScore > 0
          ? Math.min(Number(((score / maxScore) * 100).toFixed(2)), 100)
          : 0;
      let passed = null;

      if (awaitingEssayGrade) {
        passed = null;
      } else if (isQuiz) {
        const config = exercise.QuizConfig ? JSON.parse(exercise.QuizConfig) : {};
        const passScore = typeof config.passScore === 'number' && Number.isFinite(config.passScore)
          ? config.passScore
          : null;
        if (passScore !== null) passed = percentage >= passScore;
      } else if (attempt.Submissions.length) {
        passed = attempt.Submissions.some((submission) => submission.IsCorrect);
      }

      return {
        attemptId: attempt.AttemptID,
        title: exercise.Title,
        type: isQuiz ? 'Quiz' : 'Practice',
        courseName: exercise.Lessons?.Chapters?.Courses?.Title || '',
        chapterName: exercise.Lessons?.Chapters?.Title || '',
        lessonName: exercise.Lessons?.Title || '',
        startTime: attempt.StartTime,
        endTime: attempt.EndTime,
        score,
        maxScore,
        percentage,
        passed,
        gradingStatus
      };
    });
    const visibleResults = results.filter((result) => result.percentage !== null);
    const scoredResults = visibleResults.filter((result) => result.passed !== null);
    const passedCount = scoredResults.filter((result) => result.passed).length;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          attemptCount: results.length,
          averagePercentage: visibleResults.length
            ? Number((visibleResults.reduce((sum, result) => sum + result.percentage, 0) / visibleResults.length).toFixed(1))
            : 0,
          passedCount,
          passRate: scoredResults.length
            ? Number(((passedCount / scoredResults.length) * 100).toFixed(1))
            : 0
        },
        results
      }
    });
  } catch (error) {
    console.error('Lỗi lấy kết quả học tập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getStudentQuizResultDetail = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const attemptId = Number.parseInt(req.params.attemptId, 10);

    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return res.status(400).json({ success: false, message: 'Lượt làm bài không hợp lệ' });
    }

    const attempt = await prisma.testAttempts.findFirst({
      where: { AttemptID: attemptId, UserID: studentId },
      include: {
        Exercises: {
          select: { Title: true, Type: true }
        },
        Submissions: {
          orderBy: { SubmissionID: 'asc' },
          include: {
            Answers: {
              select: { AnswerID: true, Content: true }
            },
            TestQuestions: {
              select: {
                Content: true,
                QuestionType: true,
                Points: true,
                Explanation: true,
                Answers: {
                  select: { AnswerID: true, Content: true, IsCorrect: true },
                  orderBy: { AnswerID: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!attempt || attempt.Exercises.Type !== 'Quiz') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả bài kiểm tra' });
    }
    if (
      ['Pending', 'Draft'].includes(attempt.GradingStatus) &&
      attempt.Submissions.some((submission) => submission.TestQuestions.QuestionType === 'essay')
    ) {
      return res.status(409).json({ success: false, message: 'Kết quả đang chờ giảng viên chấm và công bố' });
    }

    const questions = attempt.Submissions.map((submission) => {
      let savedAnswer = submission.CodeSubmitted;
      let snapshot = null;

      if (typeof savedAnswer === 'string') {
        try {
          const parsed = JSON.parse(savedAnswer);
          if (parsed && typeof parsed === 'object') {
            snapshot = parsed;
            savedAnswer = parsed.answer ?? null;
          }
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      }

      return {
        question: snapshot?.question || submission.TestQuestions.Content,
        type: snapshot?.type || submission.TestQuestions.QuestionType,
        points: Number(submission.TestQuestions.Points),
        scoreEarned: Number(submission.ScoreEarned),
        isCorrect: submission.IsCorrect,
        selectedAnswer: savedAnswer ?? submission.Answers?.Content ?? null,
        correctAnswers: submission.TestQuestions.Answers
          .filter((answer) => answer.IsCorrect)
          .map((answer) => answer.Content),
        options: submission.TestQuestions.Answers.map((answer) => ({
          content: answer.Content,
          isCorrect: answer.IsCorrect,
          isSelected: answer.AnswerID === submission.Answers?.AnswerID ||
            (!submission.Answers && typeof savedAnswer === 'string' && answer.Content === savedAnswer)
        })),
        explanation: submission.TestQuestions.Explanation
      };
    });

    res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.AttemptID,
        title: attempt.Exercises.Title,
        totalScore: Number(attempt.TotalScore),
        instructorFeedback: attempt.InstructorFeedback || '',
        questions
      }
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết kết quả bài kiểm tra:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getStudentNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: { UserID: req.user.userId },
      orderBy: { CreatedAt: 'desc' },
      select: {
        NotificationID: true,
        Title: true,
        Message: true,
        IsRead: true,
        CreatedAt: true,
        NotificationType: true,
        ActionLabel: true,
        ActionUrl: true
      }
    });
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Lỗi lấy thông báo học viên:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const markAllStudentNotificationsRead = async (req, res) => {
  try {
    const updated = await prisma.notifications.updateMany({
      where: { UserID: req.user.userId, IsRead: false },
      data: { IsRead: true }
    });
    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc',
      data: { updatedCount: updated.count }
    });
  } catch (error) {
    console.error('Lỗi đánh dấu tất cả thông báo đã đọc:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const markStudentNotificationRead = async (req, res) => {
  try {
    const notificationId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ success: false, message: 'Thông báo không hợp lệ' });
    }

    const updated = await prisma.notifications.updateMany({
      where: { NotificationID: notificationId, UserID: req.user.userId },
      data: { IsRead: true }
    });
    if (!updated.count) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }
    res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái thông báo:', error);
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
  getStudentQuizzes,
  getStudentQuiz,
  submitStudentQuiz,
  getStudentResults,
  getStudentQuizResultDetail,
  getStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead
};