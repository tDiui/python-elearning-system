const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const {
  createLessonSlide,
  getLessonSlidePath,
  getSlideExtension,
  hasValidSlideSignature,
  MAX_SLIDE_SIZE,
  removeLessonSlide
} = require('../../utils/lessonSlides');
const prisma = new PrismaClient();

const getUploadedSlideAsset = (slideUrl) => {
  if (typeof slideUrl !== 'string') return null;
  try {
    const url = new URL(slideUrl, 'http://localhost');
    const asset = url.searchParams.get('asset');
    return url.pathname.endsWith('/slides/pdf') && asset && /^[a-f0-9-]{36}\.(ppt|pptx)$/.test(asset)
      ? asset
      : null;
  } catch {
    return null;
  }
};

const getSlideRouteUrl = (lessonId, asset, format) =>
  `/api/teacher/lesson/${lessonId}/slides/${format}?asset=${encodeURIComponent(asset)}`;

const calculateScorePercentage = (score, maxScore) => {
  const scoreValue = Number(score);
  const maxScoreValue = Number(maxScore);
  if (!Number.isFinite(scoreValue)) return 0;
  const scoreScale = scoreValue > 10 ? 100 : maxScoreValue || 10;
  return Math.min(100, Math.max(0, scoreValue / scoreScale * 100));
};

// 1. HÀM LẤY DỮ LIỆU DASHBOARD
const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const requestedCourseId = req.query.courseId === undefined ? null : Number(req.query.courseId);
    if (
      req.query.courseId !== undefined &&
      (!Number.isSafeInteger(requestedCourseId) || requestedCourseId <= 0)
    ) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const courses = await prisma.courses.findMany({
      where: { InstructorID: teacherId },
      orderBy: { Title: 'asc' },
      select: { CourseID: true, Title: true }
    });
    const course = requestedCourseId
      ? courses.find((item) => item.CourseID === requestedCourseId)
      : courses[0];
    if (requestedCourseId && !course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    if (!course) return res.status(200).json({ success: true, data: null, courses: [] });

    const [activeEnrollments, pendingApprovals, publishedLessons, topicProgress] = await Promise.all([
      prisma.enrollments.findMany({
        where: { CourseID: course.CourseID, Status: 'Active' },
        include: { Users: { select: { UserID: true, FullName: true, Email: true, StudentID: true } } },
        orderBy: { EnrolledAt: 'asc' }
      }),
      prisma.enrollments.count({ where: { CourseID: course.CourseID, Status: 'Pending' } }),
      prisma.lessons.findMany({
        where: { Chapters: { CourseID: course.CourseID }, Status: 'Published' },
        select: { LessonID: true, Title: true, Chapters: { select: { Title: true } } }
      }),
      prisma.studentTopicProgress.findMany({
        where: { KnowledgeTopics: { CourseID: course.CourseID } },
        select: {
          UserID: true,
          MasteryLevel: true,
          KnowledgeTopics: { select: { TopicName: true } }
        }
      })
    ]);

    const studentIds = activeEnrollments.map((enrollment) => enrollment.UserID);
    const [activities, attempts] = studentIds.length
      ? await Promise.all([
          prisma.learningActivities.findMany({
            where: { CourseID: course.CourseID, UserID: { in: studentIds } },
            select: {
              UserID: true,
              LessonID: true,
              ExerciseID: true,
              ActionType: true,
              TimeSpentSeconds: true,
              Score: true,
              IsCompleted: true,
              CreatedAt: true
            },
            orderBy: { CreatedAt: 'desc' }
          }),
          prisma.testAttempts.findMany({
            where: {
              UserID: { in: studentIds },
              Exercises: { Type: 'Quiz', Lessons: { Chapters: { CourseID: course.CourseID } } }
            },
            include: { Exercises: { select: { MaxScore: true } } }
          })
        ])
      : [[], []];

    const publishedLessonIds = new Set(publishedLessons.map((lesson) => lesson.LessonID));
    const activitiesByStudent = new Map();
    for (const activity of activities) {
      if (!activitiesByStudent.has(activity.UserID)) activitiesByStudent.set(activity.UserID, []);
      activitiesByStudent.get(activity.UserID).push(activity);
    }
    const gradedAttemptsByStudent = new Map();
    for (const attempt of attempts) {
      if (['Pending', 'Draft'].includes(attempt.GradingStatus)) continue;
      if (!gradedAttemptsByStudent.has(attempt.UserID)) gradedAttemptsByStudent.set(attempt.UserID, []);
      gradedAttemptsByStudent.get(attempt.UserID).push(attempt);
    }

    const students = activeEnrollments.map((enrollment) => {
      const studentActivities = activitiesByStudent.get(enrollment.UserID) || [];
      const completedLessonIds = new Set(studentActivities
        .filter((activity) =>
          activity.ActionType === 'LessonCompleted' &&
          activity.IsCompleted &&
          publishedLessonIds.has(activity.LessonID)
        )
        .map((activity) => activity.LessonID));
      const studentAttempts = gradedAttemptsByStudent.get(enrollment.UserID) || [];
      const scores = studentAttempts
        .filter((attempt) => Number(attempt.Exercises.MaxScore) > 0)
        .map((attempt) => calculateScorePercentage(attempt.TotalScore, attempt.Exercises.MaxScore));
      const lastActivity = studentActivities[0]?.CreatedAt || null;
      const weakTopics = topicProgress
        .filter((progress) => progress.UserID === enrollment.UserID && Number(progress.MasteryLevel) < 60)
        .map((progress) => progress.KnowledgeTopics.TopicName);
      const completion = publishedLessons.length
        ? Math.round(completedLessonIds.size / publishedLessons.length * 100)
        : 0;
      const isRecentlyActive = lastActivity &&
        Date.now() - new Date(lastActivity).getTime() <= 7 * 24 * 60 * 60 * 1000;

      return {
        id: enrollment.UserID,
        name: enrollment.Users.FullName || enrollment.Users.Email,
        studentId: enrollment.Users.StudentID,
        avatar: (enrollment.Users.FullName || enrollment.Users.Email)
          .split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase(),
        progress: completion,
        avgScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
        weakTopics,
        lastActive: lastActivity
          ? new Date(lastActivity).toLocaleString('vi-VN')
          : 'Chưa có hoạt động',
        lastActiveAt: lastActivity,
        status: isRecentlyActive ? 'Đang học' : 'Không hoạt động',
        color: 'bg-blue-600'
      };
    });

    const allScores = [...gradedAttemptsByStudent.values()].flat()
      .filter((attempt) => Number(attempt.Exercises.MaxScore) > 0)
      .map((attempt) => calculateScorePercentage(attempt.TotalScore, attempt.Exercises.MaxScore));
    const scoreRanges = [
      { range: '0-40', matches: (score) => score <= 40 },
      { range: '41-60', matches: (score) => score > 40 && score <= 60 },
      { range: '61-75', matches: (score) => score > 60 && score <= 75 },
      { range: '76-90', matches: (score) => score > 75 && score <= 90 },
      { range: '91-100', matches: (score) => score > 90 }
    ];
    const gradeDistribution = scoreRanges.map(({ range, matches }) => {
      const count = allScores.filter(matches).length;
      return { range, count, height: allScores.length ? `${Math.max(4, count / allScores.length * 100)}%` : '0%' };
    });
    const topicTotals = new Map();
    for (const progress of topicProgress) {
      const topicName = progress.KnowledgeTopics.TopicName;
      const current = topicTotals.get(topicName) || { total: 0, count: 0 };
      current.total += Number(progress.MasteryLevel);
      current.count += 1;
      topicTotals.set(topicName, current);
    }
    const hardTopics = [...topicTotals.entries()]
      .map(([name, value]) => ({ name, percent: Math.round(value.total / value.count) }))
      .filter((topic) => topic.percent < 60)
      .sort((left, right) => left.percent - right.percent)
      .slice(0, 5)
      .map((topic) => ({
        ...topic,
        color: 'bg-amber-500',
        text: 'text-amber-600'
      }));
    const completedStudents = students.filter((student) => student.progress === 100).length;
    const inProgressStudents = students.filter((student) => student.progress > 0 && student.progress < 100).length;
    const data = {
      courseId: course.CourseID,
      courseName: course.Title,
      totalStudentsClass: activeEnrollments.length,
      publishedLessonCount: publishedLessons.length,
      stats: {
        totalStudents: activeEnrollments.length,
        activeStudents: students.filter((student) => student.status === 'Đang học').length,
        courseCompletion: students.length ? Math.round(students.reduce((sum, student) => sum + student.progress, 0) / students.length) : 0,
        completedStudents,
        inProgressStudents,
        notStartedStudents: students.filter((student) => student.progress === 0).length,
        avgScore: allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : null
      },
      pendingApprovals,
      gradeDistribution,
      hardTopics,
      students
    };

    return res.status(200).json({
      success: true,
      data,
      courses: courses.map((item) => ({ id: item.CourseID, title: item.Title }))
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu Teacher Dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getTeacherStudentProgress = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học hoặc học viên không hợp lệ.' });
    }

    const enrollment = await prisma.enrollments.findFirst({
      where: {
        CourseID: courseId,
        UserID: studentId,
        Status: { in: ['Active', 'Removed'] },
        Courses: { InstructorID: req.user.userId }
      },
      include: {
        Courses: { select: { Title: true } },
        Users: { select: { FullName: true, Email: true, StudentID: true } }
      }
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch sử ghi danh của học viên trong khóa học của bạn.' });
    }

    const [publishedLessons, activities, attempts] = await Promise.all([
      prisma.lessons.findMany({
        where: { Chapters: { CourseID: courseId }, Status: 'Published' },
        select: { LessonID: true, Title: true, Chapters: { select: { Title: true } } },
        orderBy: [{ Chapters: { OrderIndex: 'asc' } }, { OrderIndex: 'asc' }]
      }),
      prisma.learningActivities.findMany({
        where: { CourseID: courseId, UserID: studentId },
        include: {
          Lessons: { select: { Title: true } },
          Exercises: { select: { Title: true, Type: true } }
        },
        orderBy: { CreatedAt: 'desc' }
      }),
      prisma.testAttempts.findMany({
        where: {
          UserID: studentId,
          Exercises: { Type: 'Quiz', Lessons: { Chapters: { CourseID: courseId } } }
        },
        include: {
          Exercises: { select: { Title: true, MaxScore: true } },
          Submissions: {
            include: {
              Answers: { select: { Content: true } },
              TestQuestions: { select: { Content: true } }
            },
            orderBy: { SubmissionID: 'asc' }
          }
        },
        orderBy: { StartTime: 'desc' }
      })
    ]);

    const publishedLessonIds = new Set(publishedLessons.map((lesson) => lesson.LessonID));
    const completedLessonIds = new Set(activities
      .filter((activity) =>
        activity.ActionType === 'LessonCompleted' &&
        activity.IsCompleted &&
        publishedLessonIds.has(activity.LessonID)
      )
      .map((activity) => activity.LessonID));
    const gradedAttempts = attempts.filter((attempt) => !['Pending', 'Draft'].includes(attempt.GradingStatus));
    const scores = gradedAttempts
      .filter((attempt) => Number(attempt.Exercises.MaxScore) > 0)
      .map((attempt) => calculateScorePercentage(attempt.TotalScore, attempt.Exercises.MaxScore));
    const timeSpentSeconds = activities.reduce((total, activity) => total + activity.TimeSpentSeconds, 0);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: studentId,
          name: enrollment.Users.FullName || enrollment.Users.Email,
          email: enrollment.Users.Email,
          studentId: enrollment.Users.StudentID
        },
        course: { id: courseId, title: enrollment.Courses.Title },
        summary: {
          lessonCount: publishedLessons.length,
          completedLessonCount: completedLessonIds.size,
          completionPercent: publishedLessons.length
            ? Math.round(completedLessonIds.size / publishedLessons.length * 100)
            : 0,
          timeSpentSeconds,
          averageScore: scores.length
            ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
            : null,
          lastActive: activities[0]?.CreatedAt || null
        },
        lessons: publishedLessons.map((lesson) => ({
          id: lesson.LessonID,
          title: lesson.Title,
          chapter: lesson.Chapters.Title,
          isCompleted: completedLessonIds.has(lesson.LessonID)
        })),
        activities: activities.map((activity) => ({
          id: String(activity.ActivityID),
          actionType: activity.ActionType,
          lessonTitle: activity.Lessons?.Title || null,
          exerciseTitle: activity.Exercises?.Title || null,
          timeSpentSeconds: activity.TimeSpentSeconds,
          score: activity.Score === null ? null : Number(activity.Score),
          isCompleted: activity.IsCompleted,
          createdAt: activity.CreatedAt
        })),
        attempts: attempts.map((attempt) => ({
          id: attempt.AttemptID,
          quizTitle: attempt.Exercises.Title,
          startedAt: attempt.StartTime,
          submittedAt: attempt.EndTime,
          totalScore: Number(attempt.TotalScore),
          maxScore: Number(attempt.Exercises.MaxScore),
          scorePercent: !['Pending', 'Draft'].includes(attempt.GradingStatus) && Number(attempt.Exercises.MaxScore) > 0
            ? calculateScorePercentage(attempt.TotalScore, attempt.Exercises.MaxScore)
            : null,
          gradingStatus: attempt.GradingStatus || 'Published',
          answers: attempt.Submissions.map((submission) => {
            let answer = submission.Answers?.Content ?? submission.CodeSubmitted;
            if (typeof submission.CodeSubmitted === 'string') {
              try {
                const parsed = JSON.parse(submission.CodeSubmitted);
                if (parsed && typeof parsed === 'object' && 'answer' in parsed) answer = parsed.answer;
              } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
              }
            }
            return {
              question: submission.TestQuestions.Content,
              answer: typeof answer === 'string' || typeof answer === 'boolean' ? answer : null,
              score: Number(submission.ScoreEarned),
              isCorrect: submission.IsCorrect
            };
          })
        }))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy tiến độ chi tiết học viên:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải tiến độ học viên.' });
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

// Lấy chi tiết quản lý khóa học (Chapters, Lessons...)
const getTeacherCourseManagement = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const [course, categories] = await Promise.all([
      prisma.courses.findFirst({
        where: { InstructorID: teacherId },
        include: {
          Categories: { select: { CategoryID: true, CategoryName: true } },
          Chapters: {
            orderBy: { OrderIndex: 'asc' },
            include: {
              Lessons: {
                orderBy: { OrderIndex: 'asc' },
                include: { Exercises: true } // Lấy kèm bài tập liên kết
              }
            }
          }
        }
      }),
      prisma.categories.findMany({
        orderBy: { CategoryName: 'asc' },
        select: { CategoryID: true, CategoryName: true }
      })
    ]);

    if (!course) return res.status(200).json({ success: true, data: null });

    const lessonIds = course.Chapters.flatMap(chapter =>
      chapter.Lessons.filter((lesson) => lesson.Status === 'Published').map((lesson) => lesson.LessonID)
    );
    const completionActivities = lessonIds.length
      ? await prisma.learningActivities.findMany({
          where: {
            CourseID: course.CourseID,
            LessonID: { in: lessonIds },
            ActionType: 'LessonCompleted',
            IsCompleted: true
          },
          select: {
            LessonID: true,
            UserID: true,
            Users: { select: { FullName: true, Email: true } }
          },
          orderBy: { CreatedAt: 'asc' }
        })
      : [];
    const completedStudentsByLesson = new Map();
    for (const activity of completionActivities) {
      if (!activity.LessonID) continue;
      if (!completedStudentsByLesson.has(activity.LessonID)) {
        completedStudentsByLesson.set(activity.LessonID, new Map());
      }
      completedStudentsByLesson.get(activity.LessonID).set(activity.UserID, {
        id: activity.UserID,
        name: activity.Users.FullName || activity.Users.Email
      });
    }

    const formattedData = {
      id: course.CourseID,
      title: course.Title,
      description: course.Description || '',
      categoryId: course.CategoryID,
      categoryName: course.Categories.CategoryName,
      status: course.Status,
      categories: categories.map((category) => ({
        id: category.CategoryID,
        name: category.CategoryName
      })),
      stats: {
        lessons: course.Chapters.reduce((acc, ch) => acc + ch.Lessons.length, 0),
        exercises: 8, quizzes: 4
      },
      chapters: course.Chapters.map(ch => ({
        id: ch.ChapterID, title: ch.Title, progress: `${ch.Lessons.length} bài`,
        lessons: ch.Lessons.map(lesson => {
          const completedStudents = [...(completedStudentsByLesson.get(lesson.LessonID)?.values() || [])];
          return {
            id: lesson.LessonID, title: lesson.Title, isDraft: lesson.Status !== 'Published',
            durationMinutes: lesson.DurationMinutes,
            completedStudentCount: completedStudents.length,
            completedStudents,
            content: lesson.ArticleContent || '',
            objectives: lesson.Objectives ? JSON.parse(lesson.Objectives) : [], // Parse JSON
            codeExample: lesson.CodeExample || '',
            hasVideo: lesson.HasVideo,
            videoUrl: lesson.VideoUrl || '',
            hasSlide: lesson.HasSlide,
            slideUrl: lesson.SlideUrl || '',
            slideOriginalUrl: getUploadedSlideAsset(lesson.SlideUrl)
              ? getSlideRouteUrl(lesson.LessonID, getUploadedSlideAsset(lesson.SlideUrl), 'original')
              : '',
            exercises: lesson.Exercises.map(ex => ({ id: ex.ExerciseID, title: ex.Title }))
          };
        })
      }))
    };
    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST: TẠO KHÓA HỌC MỚI
const createCourse = async (req, res) => {
  try {
    const { title } = req.body;
    const teacherId = req.user.userId;

    // BẢN VÁ 1: Bảng Courses bắt buộc phải có CategoryID (NOT NULL).
    // Ở đây ta tìm danh mục đầu tiên trong Database. Nếu DB trống, tự động tạo 1 danh mục mặc định.
    let category = await prisma.categories.findFirst();
    if (!category) {
      category = await prisma.categories.create({
        data: { CategoryName: 'Lập trình cơ bản', Description: 'Danh mục mặc định' }
      });
    }

    const newCourse = await prisma.courses.create({
      data: {
        Title: title,
        InstructorID: teacherId,
        CategoryID: category.CategoryID, // Đã bổ sung trường bắt buộc
        Status: 'Draft' // Sử dụng đúng cột Status trong SQL của bạn
      }
    });
    res.status(201).json({ success: true, data: newCourse });
  } catch (error) {
    console.error('Lỗi tạo khóa học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    const { title, description, categoryId } = req.body || {};
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const data = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        return res.status(400).json({ success: false, message: 'Tên khóa học phải từ 1 đến 200 ký tự.' });
      }
      data.Title = title.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Mô tả khóa học không hợp lệ.' });
      }
      data.Description = description.trim() || null;
    }
    if (categoryId !== undefined) {
      const parsedCategoryId = Number(categoryId);
      if (!Number.isSafeInteger(parsedCategoryId) || parsedCategoryId <= 0) {
        return res.status(400).json({ success: false, message: 'Danh mục khóa học không hợp lệ.' });
      }
      const category = await prisma.categories.findUnique({
        where: { CategoryID: parsedCategoryId },
        select: { CategoryID: true }
      });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Danh mục khóa học không tồn tại.' });
      }
      data.CategoryID = parsedCategoryId;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin khóa học cần cập nhật.' });
    }

    const ownedCourse = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!ownedCourse) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    const updated = await prisma.courses.update({
      where: { CourseID: courseId },
      data,
      select: { CourseID: true, Title: true, Description: true, CategoryID: true }
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Lỗi cập nhật khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật khóa học.' });
  }
};

const updateCourseStatus = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !['Draft', 'Published'].includes(status)
    ) {
      return res.status(400).json({ success: false, message: 'Trạng thái khóa học không hợp lệ.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    const updated = await prisma.courses.update({
      where: { CourseID: courseId },
      data: { Status: status },
      select: { CourseID: true, Status: true }
    });
    return res.status(200).json({
      success: true,
      data: { id: updated.CourseID, status: updated.Status }
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái khóa học.' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: {
        CourseID: true,
        Chapters: {
          select: {
            Lessons: {
              select: {
                LessonID: true,
                SlideUrl: true,
                Exercises: { select: { ExerciseID: true } }
              }
            }
          }
        },
        KnowledgeTopics: {
          select: { Exercises: { select: { ExerciseID: true } } }
        }
      }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }

    const lessonIds = course.Chapters.flatMap((chapter) => chapter.Lessons.map((lesson) => lesson.LessonID));
    const exerciseIds = [...new Set([
      ...course.Chapters.flatMap((chapter) =>
        chapter.Lessons.flatMap((lesson) => lesson.Exercises.map((exercise) => exercise.ExerciseID))
      ),
      ...course.KnowledgeTopics.flatMap((topic) =>
        topic.Exercises.map((exercise) => exercise.ExerciseID)
      )
    ])];
    const [enrollmentCount, activityCount, pathCount, profileCount, statsCount, topicProgressCount, attemptCount] =
      await Promise.all([
        prisma.enrollments.count({ where: { CourseID: courseId } }),
        prisma.learningActivities.count({
          where: {
            OR: [
              { CourseID: courseId },
              ...(lessonIds.length ? [{ LessonID: { in: lessonIds } }] : []),
              ...(exerciseIds.length ? [{ ExerciseID: { in: exerciseIds } }] : [])
            ]
          }
        }),
        prisma.learningPaths.count({ where: { CourseID: courseId } }),
        prisma.learningProfiles.count({ where: { CourseID: courseId } }),
        prisma.studentLearningStats.count({ where: { CourseID: courseId } }),
        prisma.studentTopicProgress.count({ where: { KnowledgeTopics: { CourseID: courseId } } }),
        prisma.testAttempts.count({ where: { ExerciseID: { in: exerciseIds } } })
      ]);
    if (
      enrollmentCount > 0 ||
      activityCount > 0 ||
      pathCount > 0 ||
      profileCount > 0 ||
      statsCount > 0 ||
      topicProgressCount > 0 ||
      attemptCount > 0
    ) {
      return res.status(409).json({
        success: false,
        message: 'Không thể xóa khóa học đã có ghi danh hoặc lịch sử học tập. Bạn có thể chuyển khóa học về Draft để ẩn.'
      });
    }

    await prisma.$transaction(async (tx) => {
      if (lessonIds.length) {
        await tx.lessonTopics.deleteMany({ where: { LessonID: { in: lessonIds } } });
      }
      if (exerciseIds.length) {
        await tx.testQuestions.deleteMany({ where: { ExerciseID: { in: exerciseIds } } });
        await tx.exercises.deleteMany({ where: { ExerciseID: { in: exerciseIds } } });
      }
      if (lessonIds.length) {
        await tx.lessons.deleteMany({ where: { LessonID: { in: lessonIds } } });
      }
      await tx.knowledgeTopics.deleteMany({ where: { CourseID: courseId } });
      await tx.chapters.deleteMany({ where: { CourseID: courseId } });
      await tx.courses.delete({ where: { CourseID: courseId } });
    });

    for (const lesson of course.Chapters.flatMap((chapter) => chapter.Lessons)) {
      const asset = getUploadedSlideAsset(lesson.SlideUrl);
      if (!asset) continue;
      try {
        await removeLessonSlide(lesson.LessonID, asset);
      } catch (cleanupError) {
        console.error('Lỗi dọn slide sau khi xóa khóa học:', cleanupError);
      }
    }
    return res.status(200).json({ success: true, message: 'Đã xóa khóa học.' });
  } catch (error) {
    console.error('Lỗi xóa khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa khóa học.' });
  }
};

const reorderChapters = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    const chapterIds = req.body?.chapterIds;
    if (
      !Number.isInteger(courseId) ||
      courseId <= 0 ||
      !Array.isArray(chapterIds) ||
      chapterIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(chapterIds).size !== chapterIds.length
    ) {
      return res.status(400).json({ success: false, message: 'Danh sách thứ tự chương không hợp lệ.' });
    }

    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { Chapters: { select: { ChapterID: true } } }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    const existingIds = course.Chapters.map((chapter) => chapter.ChapterID);
    if (
      existingIds.length !== chapterIds.length ||
      existingIds.some((id) => !chapterIds.includes(id))
    ) {
      return res.status(400).json({ success: false, message: 'Thứ tự phải chứa đủ các chương của khóa học.' });
    }

    await prisma.$transaction(
      chapterIds.map((chapterId, index) =>
        prisma.chapters.update({
          where: { ChapterID: chapterId },
          data: { OrderIndex: index + 1 }
        })
      )
    );
    return res.status(200).json({ success: true, message: 'Đã cập nhật thứ tự chương.' });
  } catch (error) {
    console.error('Lỗi sắp xếp chương:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thứ tự chương.' });
  }
};

const reorderLessons = async (req, res) => {
  try {
    const chapterId = Number.parseInt(req.params.id, 10);
    const lessonIds = req.body?.lessonIds;
    if (
      !Number.isInteger(chapterId) ||
      chapterId <= 0 ||
      !Array.isArray(lessonIds) ||
      lessonIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(lessonIds).size !== lessonIds.length
    ) {
      return res.status(400).json({ success: false, message: 'Danh sách thứ tự bài học không hợp lệ.' });
    }

    const chapter = await prisma.chapters.findFirst({
      where: {
        ChapterID: chapterId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { Lessons: { select: { LessonID: true } } }
    });
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương thuộc quyền quản lý của bạn.' });
    }
    const existingIds = chapter.Lessons.map((lesson) => lesson.LessonID);
    if (
      existingIds.length !== lessonIds.length ||
      existingIds.some((id) => !lessonIds.includes(id))
    ) {
      return res.status(400).json({ success: false, message: 'Thứ tự phải chứa đủ bài học của chương.' });
    }

    await prisma.$transaction(
      lessonIds.map((lessonId, index) =>
        prisma.lessons.update({
          where: { LessonID: lessonId },
          data: { OrderIndex: index + 1 }
        })
      )
    );
    return res.status(200).json({ success: true, message: 'Đã cập nhật thứ tự bài học.' });
  } catch (error) {
    console.error('Lỗi sắp xếp bài học:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thứ tự bài học.' });
  }
};

// POST: TẠO CHAPTER MỚI
const createChapter = async (req, res) => {
  try {
    const courseId = Number(req.body?.courseId);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!Number.isSafeInteger(courseId) || courseId <= 0 || !title) {
      return res.status(400).json({ success: false, message: 'Khóa học và tên chương là bắt buộc.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }

    // Đếm số chapter hiện có để tự động tăng số thứ tự (OrderIndex)
    const count = await prisma.chapters.count({ where: { CourseID: courseId } });
    
    const newChapter = await prisma.chapters.create({
      data: {
        CourseID: courseId,
        Title: title,
        OrderIndex: count + 1
      }
    });
    res.status(201).json({ success: true, data: newChapter });
  } catch (error) {
    console.error('Lỗi tạo Chapter:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST: TẠO BÀI HỌC MỚI (LESSON)
const createLesson = async (req, res) => {
  try {
    const chapterId = Number(req.body?.chapterId);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!Number.isSafeInteger(chapterId) || chapterId <= 0 || !title) {
      return res.status(400).json({ success: false, message: 'Chương và tên bài học là bắt buộc.' });
    }
    const chapter = await prisma.chapters.findFirst({
      where: {
        ChapterID: chapterId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { ChapterID: true }
    });
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương thuộc quyền quản lý của bạn.' });
    }

    const count = await prisma.lessons.count({ where: { ChapterID: chapterId } });
    
    const newLesson = await prisma.lessons.create({
      data: {
        ChapterID: chapterId,
        Title: title,
        OrderIndex: count + 1,
        // BẢN VÁ 2: Tuân thủ cấu trúc cột HasArticle thay vì LessonType
        HasArticle: true,
        HasVideo: false,
        HasSlide: false,
        DurationMinutes: 0,
        Status: 'Draft',
        ArticleContent: '<p>Đây là nội dung bài học mới. Nhấn vào nút "Sửa" để thay đổi.</p>'
      }
    });
    res.status(201).json({ success: true, data: newLesson });
  } catch (error) {
    console.error('Lỗi tạo Bài học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};



// PUT: ĐỔI TÊN CHAPTER
const updateChapter = async (req, res) => {
  try {
    const chapterId = Number.parseInt(req.params.id, 10);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!Number.isInteger(chapterId) || chapterId <= 0 || !title) {
      return res.status(400).json({ success: false, message: 'ID chương và tên chương hợp lệ là bắt buộc.' });
    }
    const chapter = await prisma.chapters.findFirst({
      where: { ChapterID: chapterId, Courses: { InstructorID: req.user.userId } },
      select: { ChapterID: true }
    });
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương thuộc quyền quản lý của bạn.' });
    }
    const updated = await prisma.chapters.update({
      where: { ChapterID: chapterId },
      data: { Title: title }
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// DELETE: XÓA CHAPTER (Tự động xóa luôn các bài học bên trong nhờ CASCADE)
const deleteChapter = async (req, res) => {
  try {
    const chapterId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      return res.status(400).json({ success: false, message: 'ID chương không hợp lệ.' });
    }
    const chapter = await prisma.chapters.findUnique({
      where: { ChapterID: chapterId },
      select: {
        Courses: { select: { InstructorID: true } },
        Lessons: { select: { LessonID: true, SlideUrl: true } }
      }
    });
    if (!chapter || chapter.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương thuộc khóa học của bạn.' });
    }
    await prisma.chapters.delete({ where: { ChapterID: chapterId } });
    for (const lesson of chapter.Lessons) {
      const asset = getUploadedSlideAsset(lesson.SlideUrl);
      if (!asset) continue;
      try {
        await removeLessonSlide(lesson.LessonID, asset);
      } catch (cleanupError) {
        console.error('Lỗi dọn slide sau khi xóa chương:', cleanupError);
      }
    }
    res.status(200).json({ success: true, message: 'Đã xóa chapter' });
  } catch (error) {
    console.error('Lỗi xóa chương:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};


const updateLessonStatus = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (!Number.isInteger(lessonId) || lessonId <= 0 || !['Draft', 'Published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái bài học không hợp lệ.' });
    }

    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: {
        Chapters: { select: { Courses: { select: { InstructorID: true } } } }
      }
    });
    if (!lesson || lesson.Chapters.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }

    const updated = await prisma.lessons.update({
      where: { LessonID: lessonId },
      data: { Status: status },
      select: { LessonID: true, Status: true }
    });
    return res.status(200).json({
      success: true,
      data: { id: updated.LessonID, status: updated.Status, isDraft: updated.Status === 'Draft' }
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái bài học:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái bài học.' });
  }
};

// PUT: CẬP NHẬT BÀI HỌC (Đổi tên hoặc Đổi nội dung)
const updateLesson = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài học không hợp lệ.' });
    }

    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: {
        Status: true,
        Chapters: { select: { Courses: { select: { InstructorID: true } } } }
      }
    });
    if (!lesson || lesson.Chapters.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }

    const { title, content, objectives, codeExample, videoUrl, slideUrl, durationMinutes } = req.body || {};
    const hasLessonChanges = [title, content, objectives, codeExample, videoUrl, slideUrl, durationMinutes]
      .some(value => value !== undefined);
    if (lesson.Status === 'Published' && hasLessonChanges) {
      return res.status(409).json({
        success: false,
        message: 'Hãy chuyển bài học về Draft trước khi chỉnh sửa nội dung.'
      });
    }

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.Title = title;
    if (content !== undefined) dataToUpdate.ArticleContent = content;
    if (objectives !== undefined) dataToUpdate.Objectives = JSON.stringify(objectives); // Lưu dạng JSON
    if (codeExample !== undefined) dataToUpdate.CodeExample = codeExample;
    if (durationMinutes !== undefined) {
      if (!Number.isInteger(durationMinutes) || durationMinutes < 0) {
        return res.status(400).json({ success: false, message: 'Thời lượng bài học phải là số phút nguyên không âm.' });
      }
      dataToUpdate.DurationMinutes = durationMinutes;
    }

    for (const [field, value] of [['videoUrl', videoUrl], ['slideUrl', slideUrl]]) {
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length > 500) {
        return res.status(400).json({ success: false, message: 'Liên kết media không được vượt quá 500 ký tự.' });
      }
      const trimmedUrl = value.trim();
      if (trimmedUrl) {
        try {
          const parsedUrl = new URL(trimmedUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
        } catch {
          return res.status(400).json({
            success: false,
            message: field === 'videoUrl'
              ? 'Liên kết video phải là URL http hoặc https hợp lệ.'
              : 'Liên kết slide phải là URL http hoặc https hợp lệ.'
          });
        }
      }

      if (field === 'videoUrl') {
        dataToUpdate.VideoUrl = trimmedUrl || null;
        dataToUpdate.HasVideo = Boolean(trimmedUrl);
      } else {
        dataToUpdate.SlideUrl = trimmedUrl || null;
        dataToUpdate.HasSlide = Boolean(trimmedUrl);
      }
    }

    const currentLesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: { SlideUrl: true }
    });
    const updated = await prisma.lessons.update({
      where: { LessonID: lessonId },
      data: dataToUpdate
    });
    const previousAsset = getUploadedSlideAsset(currentLesson?.SlideUrl);
    if (previousAsset && slideUrl !== undefined && updated.SlideUrl !== currentLesson.SlideUrl) {
      try {
        await removeLessonSlide(lessonId, previousAsset);
      } catch (cleanupError) {
        console.error('Lỗi dọn slide cũ sau khi thay liên kết:', cleanupError);
      }
    }
    res.status(200).json({
      success: true,
      data: {
        id: updated.LessonID,
        videoUrl: updated.VideoUrl || '',
        hasVideo: updated.HasVideo,
        slideUrl: updated.SlideUrl || '',
        slideOriginalUrl: getUploadedSlideAsset(updated.SlideUrl)
          ? getSlideRouteUrl(lessonId, getUploadedSlideAsset(updated.SlideUrl), 'original')
          : '',
        hasSlide: updated.HasSlide
      }
    });
  } catch (error) {
    console.error('Lỗi cập nhật bài học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const uploadLessonSlide = async (req, res) => {
  const lessonId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return res.status(400).json({ success: false, message: 'ID bài học không hợp lệ.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp .ppt hoặc .pptx.' });
  }
  const slideExtension = getSlideExtension(req.file.originalname);
  if (
    req.file.size > MAX_SLIDE_SIZE ||
    !hasValidSlideSignature(req.file.buffer, slideExtension)
  ) {
    return res.status(400).json({ success: false, message: 'Tệp PowerPoint không hợp lệ hoặc vượt quá 25 MB.' });
  }

  let uploadedSlide;
  try {
    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: {
        Status: true,
        SlideUrl: true,
        Chapters: { select: { Courses: { select: { InstructorID: true } } } }
      }
    });
    if (!lesson || lesson.Chapters.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }
    if (lesson.Status !== 'Draft') {
      return res.status(409).json({ success: false, message: 'Hãy chuyển bài học về Draft trước khi chỉnh sửa slide.' });
    }

    uploadedSlide = await createLessonSlide(lessonId, req.file.buffer, req.file.originalname);
    const savedLesson = await prisma.lessons.update({
      where: { LessonID: lessonId },
      data: { SlideUrl: uploadedSlide.slideUrl, HasSlide: true },
      select: { LessonID: true, SlideUrl: true, HasSlide: true }
    });

    const previousAsset = getUploadedSlideAsset(lesson.SlideUrl);
    if (previousAsset && previousAsset !== uploadedSlide.asset) {
      try {
        await removeLessonSlide(lessonId, previousAsset);
      } catch (cleanupError) {
        console.error('Lỗi dọn slide cũ sau khi thay tệp:', cleanupError);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Đã tải slide lên và chuyển đổi sang PDF.',
      data: {
        lessonId: savedLesson.LessonID,
        slideUrl: savedLesson.SlideUrl,
        originalUrl: getSlideRouteUrl(lessonId, uploadedSlide.asset, 'original')
      }
    });
  } catch (error) {
    if (uploadedSlide) {
      try {
        await removeLessonSlide(lessonId, uploadedSlide.asset);
      } catch (cleanupError) {
        console.error('Lỗi dọn tệp slide tải lên không thành công:', cleanupError);
      }
    }
    console.error('Lỗi tải/chuyển đổi slide:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể tải hoặc chuyển đổi tệp slide.'
    });
  }
};

const getTeacherLessonSlide = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    const { format } = req.params;
    const asset = typeof req.query.asset === 'string' ? req.query.asset : '';
    if (!Number.isInteger(lessonId) || lessonId <= 0 || !['pdf', 'original'].includes(format)) {
      return res.status(400).json({ success: false, message: 'Yêu cầu tệp slide không hợp lệ.' });
    }

    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: {
        HasSlide: true,
        SlideUrl: true,
        Chapters: { select: { Courses: { select: { InstructorID: true } } } }
      }
    });
    if (!lesson || lesson.Chapters.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }
    if (!lesson.HasSlide || getUploadedSlideAsset(lesson.SlideUrl) !== asset) {
      return res.status(404).json({ success: false, message: 'Tệp slide không tồn tại.' });
    }

    const filePath = getLessonSlidePath(lessonId, asset, format);
    await fs.promises.access(filePath, fs.constants.R_OK);
    res.setHeader('Cache-Control', 'private, no-store');
    if (format === 'pdf') {
      res.type('application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="lesson-slide.pdf"');
    } else {
      res.type(asset.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint');
      res.setHeader('Content-Disposition', `attachment; filename="lesson-slide${asset.endsWith('.pptx') ? '.pptx' : '.ppt'}"`);
    }
    return res.sendFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Tệp slide chưa được tạo hoặc đã bị xóa.' });
    console.error('Lỗi đọc slide cho giảng viên:', error);
    return res.status(500).json({ success: false, message: 'Không thể mở tệp slide.' });
  }
};

// DELETE: XÓA BÀI HỌC
const deleteLesson = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài học không hợp lệ.' });
    }
    const lesson = await prisma.lessons.findUnique({
      where: { LessonID: lessonId },
      select: {
        SlideUrl: true,
        Chapters: { select: { Courses: { select: { InstructorID: true } } } }
      }
    });
    if (!lesson || lesson.Chapters.Courses.InstructorID !== req.user.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }
    await prisma.lessons.delete({ where: { LessonID: lessonId } });
    const asset = getUploadedSlideAsset(lesson.SlideUrl);
    if (asset) {
      try {
        await removeLessonSlide(lessonId, asset);
      } catch (cleanupError) {
        console.error('Lỗi dọn slide sau khi xóa bài học:', cleanupError);
      }
    }
    res.status(200).json({ success: true, message: 'Đã xóa bài học' });
  } catch (error) {
    console.error('Lỗi xóa bài học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST: TẠO BÀI TẬP MỚI
const createExercise = async (req, res) => {
  try {
    const { lessonId, title, difficulty } = req.body;
    
    // Kiểm tra bắt buộc phải có LessonID
    if (!lessonId) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn Chủ đề (Bài học)' });
    }

    const parsedLessonId = Number(lessonId);
    if (!Number.isSafeInteger(parsedLessonId) || parsedLessonId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài học không hợp lệ.' });
    }

    const lesson = await prisma.lessons.findFirst({
      where: {
        LessonID: parsedLessonId,
        Chapters: { Courses: { InstructorID: req.user.userId } }
      },
      select: {
        Title: true,
        Chapters: { select: { CourseID: true, Title: true } }
      }
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học' });
    }

    const topicName = lesson.Chapters.Title.slice(0, 150);
    let topic = await prisma.knowledgeTopics.findFirst({
      where: {
        CourseID: lesson.Chapters.CourseID,
        TopicName: topicName
      }
    });

    if (!topic) {
      topic = await prisma.knowledgeTopics.create({
        data: {
          CourseID: lesson.Chapters.CourseID,
          TopicName: topicName,
          Description: lesson.Title
        }
      });
    }

    // Chuyển đổi chữ Easy/Medium/Hard thành số 1/2/3 cho SQL
    const diffLevel = difficulty === 'Hard' ? 3 : difficulty === 'Medium' ? 2 : 1;

    const newEx = await prisma.exercises.create({
      data: {
        LessonID: parsedLessonId,
        TopicID: topic.TopicID,
        Title: title, 
        Type: 'Practice',
        TimeLimitMinutes: 15, 
        DifficultyLevel: diffLevel, 
        MaxScore: 10,
        Status: 'Draft'
      }
    });
    res.status(201).json({ success: true, data: newEx });
  } catch (error) {
    console.error('Lỗi tạo bài tập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const deleteExercise = async (req, res) => {
  try {
    const exerciseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài tập không hợp lệ.' });
    }
    const exercise = await prisma.exercises.findFirst({
      where: {
        ExerciseID: exerciseId,
        Lessons: { Chapters: { Courses: { InstructorID: req.user.userId } } }
      },
      select: { ExerciseID: true }
    });
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài tập thuộc khóa học của bạn.' });
    }
    await prisma.exercises.delete({ where: { ExerciseID: exerciseId } });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET: LẤY DANH SÁCH TẤT CẢ BÀI TẬP CỦA GIẢNG VIÊN
// GET: LẤY DANH SÁCH BÀI TẬP (Chỉ lấy Type = 'Practice')
const getTeacherExercises = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const exercises = await prisma.exercises.findMany({
      where: {
        Type: 'Practice',
        Lessons: { Chapters: { Courses: { InstructorID: teacherId } } }
      },
      include: { Lessons: { include: { Chapters: true } } }
    });

    const formattedExercises = exercises.map(ex => ({
      id: ex.ExerciseID,
      title: ex.Title,
      chapter: ex.Lessons?.Chapters?.Title || 'N/A',
      difficulty: ex.DifficultyLevel === 1 ? 'Easy' : ex.DifficultyLevel === 2 ? 'Medium' : 'Hard',
      timeLimit: ex.TimeLimitMinutes,
      status: ex.Status,
      content: ex.Content || '',
      starterCode: ex.StarterCode || '',
      hints: ex.Hints ? JSON.parse(ex.Hints) : [],
      testCases: ex.TestCases ? JSON.parse(ex.TestCases) : []
    }));

    res.status(200).json({ success: true, data: formattedExercises });
  } catch (error) {
    console.error('Lỗi lấy danh sách Bài tập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const normalizeQuestionBankInput = (input) => {
  const allowedTypes = ['multipleChoice', 'trueFalse', 'fillIn', 'essay'];
  if (!input || typeof input !== 'object' || !allowedTypes.includes(input.type)) {
    return { error: 'Loại câu hỏi không hợp lệ.' };
  }
  if (typeof input.text !== 'string' || !input.text.trim()) {
    return { error: 'Nội dung câu hỏi không được để trống.' };
  }
  const points = Number(input.points);
  if (!Number.isFinite(points) || points <= 0 || points > 100) {
    return { error: 'Điểm câu hỏi phải lớn hơn 0 và không vượt quá 100.' };
  }

  const options = [];
  let correctAnswer;
  if (input.type === 'multipleChoice') {
    if (!Array.isArray(input.options) || input.options.length < 2) {
      return { error: 'Câu trắc nghiệm cần ít nhất hai lựa chọn.' };
    }
    for (const [index, option] of input.options.entries()) {
      if (!option || typeof option.text !== 'string' || !option.text.trim()) {
        return { error: 'Nội dung lựa chọn không được để trống.' };
      }
      options.push({
        id: String(option.id || index + 1),
        text: option.text.trim(),
        isCorrect: option.isCorrect === true
      });
    }
    if (options.filter((option) => option.isCorrect).length !== 1) {
      return { error: 'Câu trắc nghiệm phải có đúng một đáp án đúng.' };
    }
  } else if (input.type === 'trueFalse') {
    if (typeof input.correctAnswer !== 'boolean') {
      return { error: 'Câu đúng/sai cần chọn đáp án đúng.' };
    }
    correctAnswer = input.correctAnswer;
  } else if (input.type === 'fillIn') {
    if (typeof input.correctAnswer !== 'string' || !input.correctAnswer.trim()) {
      return { error: 'Vui lòng nhập đáp án đúng cho câu điền vào.' };
    }
    correctAnswer = input.correctAnswer.trim();
  }

  return {
    value: {
      QuestionType: input.type,
      Content: input.text.trim(),
      Points: points,
      Explanation: typeof input.explanation === 'string' && input.explanation.trim()
        ? input.explanation.trim()
        : null,
      OptionsJSON: JSON.stringify({ options, correctAnswer })
    }
  };
};

const formatQuestionBankQuestion = (question) => {
  let answerData;
  try {
    answerData = JSON.parse(question.OptionsJSON);
  } catch (error) {
    console.error(`Ngân hàng câu hỏi ${question.QuestionBankQuestionID} có OptionsJSON không hợp lệ:`, error);
    throw new Error('Dữ liệu đáp án trong ngân hàng câu hỏi không hợp lệ.');
  }
  return {
    id: String(question.QuestionBankQuestionID),
    type: question.QuestionType,
    text: question.Content,
    points: Number(question.Points),
    explanation: question.Explanation || '',
    ...(question.QuestionType === 'multipleChoice' ? { options: answerData.options || [] } : {}),
    ...(['trueFalse', 'fillIn'].includes(question.QuestionType)
      ? { correctAnswer: answerData.correctAnswer }
      : {})
  };
};

const getQuestionBank = async (req, res) => {
  try {
    const courseId = Number(req.query.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    const questions = await prisma.questionBankQuestions.findMany({
      where: { CourseID: courseId },
      orderBy: [{ CreatedAt: 'desc' }, { QuestionBankQuestionID: 'desc' }]
    });
    return res.status(200).json({
      success: true,
      data: questions.map(formatQuestionBankQuestion)
    });
  } catch (error) {
    console.error('Lỗi lấy ngân hàng câu hỏi:', error);
    return res.status(500).json({ success: false, message: error.message || 'Không thể tải ngân hàng câu hỏi.' });
  }
};

const createQuestionBankQuestion = async (req, res) => {
  try {
    const courseId = Number(req.body?.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }
    const normalized = normalizeQuestionBankInput(req.body?.question);
    if (normalized.error) {
      return res.status(400).json({ success: false, message: normalized.error });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    const question = await prisma.questionBankQuestions.create({
      data: { CourseID: courseId, ...normalized.value }
    });
    return res.status(201).json({ success: true, data: formatQuestionBankQuestion(question) });
  } catch (error) {
    console.error('Lỗi tạo câu hỏi ngân hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo câu hỏi.' });
  }
};

const updateQuestionBankQuestion = async (req, res) => {
  try {
    const questionId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ success: false, message: 'ID câu hỏi không hợp lệ.' });
    }
    const normalized = normalizeQuestionBankInput(req.body?.question);
    if (normalized.error) {
      return res.status(400).json({ success: false, message: normalized.error });
    }
    const ownedQuestion = await prisma.questionBankQuestions.findFirst({
      where: {
        QuestionBankQuestionID: questionId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { QuestionBankQuestionID: true }
    });
    if (!ownedQuestion) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi thuộc khóa học của bạn.' });
    }
    const question = await prisma.questionBankQuestions.update({
      where: { QuestionBankQuestionID: questionId },
      data: { ...normalized.value, UpdatedAt: new Date() }
    });
    return res.status(200).json({ success: true, data: formatQuestionBankQuestion(question) });
  } catch (error) {
    console.error('Lỗi cập nhật câu hỏi ngân hàng:', error);
    return res.status(500).json({ success: false, message: error.message || 'Không thể cập nhật câu hỏi.' });
  }
};

const deleteQuestionBankQuestion = async (req, res) => {
  try {
    const questionId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ success: false, message: 'ID câu hỏi không hợp lệ.' });
    }
    const ownedQuestion = await prisma.questionBankQuestions.findFirst({
      where: {
        QuestionBankQuestionID: questionId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { QuestionBankQuestionID: true }
    });
    if (!ownedQuestion) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi thuộc khóa học của bạn.' });
    }
    await prisma.questionBankQuestions.delete({
      where: { QuestionBankQuestionID: questionId }
    });
    return res.status(200).json({ success: true, message: 'Đã xóa câu hỏi khỏi ngân hàng.' });
  } catch (error) {
    console.error('Lỗi xóa câu hỏi ngân hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa câu hỏi.' });
  }
};


const updateExerciseDetails = async (req, res) => {
  try {
    const exerciseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài tập không hợp lệ.' });
    }
    const exercise = await prisma.exercises.findFirst({
      where: {
        ExerciseID: exerciseId,
        Lessons: { Chapters: { Courses: { InstructorID: req.user.userId } } }
      },
      select: { ExerciseID: true, Type: true }
    });
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài tập thuộc khóa học của bạn.' });
    }
    
    // 1. THÊM QuizConfig VÀO ĐÂY ĐỂ LẤY DỮ LIỆU TỪ FRONTEND GỬI LÊN
    const { title, difficulty, timeLimit, content, starterCode, hints, testCases, status, QuizConfig } = req.body;

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.Title = title;
    if (difficulty !== undefined) dataToUpdate.DifficultyLevel = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3;
    if (timeLimit !== undefined) dataToUpdate.TimeLimitMinutes = parseInt(timeLimit);
    if (content !== undefined) dataToUpdate.Content = content;
    if (starterCode !== undefined) dataToUpdate.StarterCode = starterCode;
    if (status !== undefined) {
      if (!['Draft', 'Published'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái bài tập không hợp lệ.' });
      }
      dataToUpdate.Status = status;
    }
    if (hints !== undefined) dataToUpdate.Hints = JSON.stringify(hints);
    if (testCases !== undefined) dataToUpdate.TestCases = JSON.stringify(testCases);
    
    // 2. THÊM DÒNG NÀY ĐỂ ĐẨY QUIZCONFIG VÀO OBJECT CẬP NHẬT
    if (QuizConfig !== undefined) dataToUpdate.QuizConfig = QuizConfig;

    await prisma.exercises.update({
      where: { ExerciseID: exerciseId },
      data: dataToUpdate
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Lỗi cập nhật Bài tập/Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET: LẤY DANH SÁCH BÀI KIỂM TRA (Type = 'Quiz')
const getTeacherQuizzes = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const quizzes = await prisma.exercises.findMany({
      where: {
        Type: 'Quiz',
        Lessons: { Chapters: { Courses: { InstructorID: teacherId } } }
      },
      include: { Lessons: { include: { Chapters: true } } }
    });

    const quizAttempts = quizzes.length
      ? await prisma.testAttempts.findMany({
          where: { ExerciseID: { in: quizzes.map((quiz) => quiz.ExerciseID) } },
          select: { ExerciseID: true, UserID: true, TotalScore: true }
        })
      : [];
    const attemptsByQuiz = new Map();

    for (const attempt of quizAttempts) {
      const attempts = attemptsByQuiz.get(attempt.ExerciseID) || [];
      attempts.push(attempt);
      attemptsByQuiz.set(attempt.ExerciseID, attempts);
    }

    const formattedQuizzes = quizzes.map(q => {
      const config = q.QuizConfig ? JSON.parse(q.QuizConfig) : {
        questionCount: 0, passScore: 70, 
        types: { multipleChoice: 0, trueFalse: 0, fillIn: 0, essay: 0 },
        tags: []
      };
      config.types = {
        multipleChoice: 0,
        trueFalse: 0,
        fillIn: 0,
        essay: 0,
        ...(config.types || {})
      };
      config.tags = Array.isArray(config.tags) ? config.tags : [];
      config.questions = Array.isArray(config.questions) ? config.questions : [];
      const attempts = attemptsByQuiz.get(q.ExerciseID) || [];
      const passScore = Number(config.passScore);
      const studentIds = new Set(attempts.map((attempt) => attempt.UserID));
      const attemptScores = attempts.map((attempt) => {
        const score = Number(attempt.TotalScore);
        const scoreScale = score > 10 ? 100 : Number(q.MaxScore) || 10;
        return scoreScale > 0 ? Math.min((score / scoreScale) * 100, 100) : 0;
      });
      const averageScore = attemptScores.length
        ? attemptScores.reduce((sum, score) => sum + score, 0) / attemptScores.length
        : 0;
      const passCount = Number.isFinite(passScore)
        ? attemptScores.filter((score) => score >= passScore).length
        : 0;

      return {
        id: q.ExerciseID,
        title: q.Title,
        chapter: q.Lessons?.Chapters?.Title || 'Ch 1',
        timeLimit: q.TimeLimitMinutes,
        status: q.Status,
        config,
        studentCount: studentIds.size,
        attemptCount: attempts.length,
        averageScore: Number(averageScore.toFixed(1)),
        passRate: attempts.length ? Number(((passCount / attempts.length) * 100).toFixed(1)) : 0
      };
    });

    res.status(200).json({ success: true, data: formattedQuizzes });
  } catch (error) {
    console.error('Lỗi lấy danh sách Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getTeacherQuizAttempts = async (req, res) => {
  try {
    const quizId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài kiểm tra không hợp lệ.' });
    }

    const quiz = await prisma.exercises.findFirst({
      where: {
        ExerciseID: quizId,
        Type: 'Quiz',
        Lessons: { Chapters: { Courses: { InstructorID: req.user.userId } } }
      },
      select: { ExerciseID: true, MaxScore: true }
    });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài kiểm tra thuộc khóa học của bạn.' });
    }

    const attempts = await prisma.testAttempts.findMany({
      where: { ExerciseID: quizId },
      orderBy: [{ StartTime: 'desc' }, { AttemptID: 'desc' }],
      include: {
        Users: { select: { FullName: true, Email: true, StudentID: true } },
        _count: { select: { Submissions: true } }
      }
    });

    return res.status(200).json({
      success: true,
      data: attempts.map((attempt) => ({
        id: attempt.AttemptID,
        studentName: attempt.Users.FullName || attempt.Users.Email,
        studentEmail: attempt.Users.Email,
        studentId: attempt.Users.StudentID,
        startedAt: attempt.StartTime,
        submittedAt: attempt.EndTime,
        totalScore: Number(attempt.TotalScore),
        maxScore: Number(quiz.MaxScore),
        gradingStatus: attempt.GradingStatus || 'Published',
        questionCount: attempt._count.Submissions
      }))
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách lượt làm quiz:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách lượt làm quiz.' });
  }
};

const getTeacherQuizAttemptDetail = async (req, res) => {
  try {
    const quizId = Number.parseInt(req.params.id, 10);
    const attemptId = Number.parseInt(req.params.attemptId, 10);
    if (
      !Number.isInteger(quizId) || quizId <= 0 ||
      !Number.isInteger(attemptId) || attemptId <= 0
    ) {
      return res.status(400).json({ success: false, message: 'ID bài kiểm tra hoặc lượt làm không hợp lệ.' });
    }

    const attempt = await prisma.testAttempts.findFirst({
      where: {
        AttemptID: attemptId,
        ExerciseID: quizId,
        Exercises: {
          Type: 'Quiz',
          Lessons: { Chapters: { Courses: { InstructorID: req.user.userId } } }
        }
      },
      include: {
        Users: { select: { FullName: true, Email: true, StudentID: true } },
        Exercises: { select: { Title: true, MaxScore: true } },
        Submissions: {
          orderBy: { SubmissionID: 'asc' },
          include: {
            Answers: { select: { AnswerID: true, Content: true } },
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
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lượt làm thuộc bài kiểm tra của bạn.' });
    }

    const questions = attempt.Submissions.map((submission) => {
      let snapshot = null;
      let submittedValue = submission.CodeSubmitted;
      if (typeof submittedValue === 'string') {
        try {
          const parsed = JSON.parse(submittedValue);
          if (parsed && typeof parsed === 'object') {
            snapshot = parsed;
            submittedValue = parsed.answer ?? null;
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
        selectedAnswer: submittedValue ?? submission.Answers?.Content ?? null,
        options: submission.TestQuestions.Answers.map((answer) => ({
          content: answer.Content,
          isCorrect: answer.IsCorrect,
          isSelected: answer.AnswerID === submission.Answers?.AnswerID ||
            (!submission.Answers && typeof submittedValue === 'string' && answer.Content === submittedValue)
        })),
        correctAnswers: submission.TestQuestions.Answers
          .filter((answer) => answer.IsCorrect)
          .map((answer) => answer.Content),
        explanation: submission.TestQuestions.Explanation
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.AttemptID,
        quizTitle: attempt.Exercises.Title,
        studentName: attempt.Users.FullName || attempt.Users.Email,
        studentEmail: attempt.Users.Email,
        studentId: attempt.Users.StudentID,
        startedAt: attempt.StartTime,
        submittedAt: attempt.EndTime,
        totalScore: Number(attempt.TotalScore),
        maxScore: Number(attempt.Exercises.MaxScore),
        gradingStatus: attempt.GradingStatus || 'Published',
        instructorFeedback: attempt.InstructorFeedback || '',
        questions
      }
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết lượt làm quiz:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải chi tiết lượt làm quiz.' });
  }
};

// POST: TẠO BÀI KIỂM TRA MỚI
const createQuiz = async (req, res) => {
  try {
    const lessonId = Number(req.body?.lessonId);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!Number.isSafeInteger(lessonId) || lessonId <= 0 || !title) {
      return res.status(400).json({ success: false, message: 'Bài học và tên bài kiểm tra là bắt buộc.' });
    }
    const lesson = await prisma.lessons.findFirst({
      where: {
        LessonID: lessonId,
        Chapters: { Courses: { InstructorID: req.user.userId } }
      },
      select: { LessonID: true }
    });
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài học thuộc khóa học của bạn.' });
    }

    const newQuiz = await prisma.exercises.create({
      data: {
        LessonID: lessonId,
        Title: title,
        Type: 'Quiz',
        TimeLimitMinutes: 15,
        DifficultyLevel: 2, // Mặc định Medium
        MaxScore: 10,
        Status: 'Draft',
        QuizConfig: JSON.stringify({
          questionCount: 0, passScore: 70, 
          types: { multipleChoice: 0, trueFalse: 0, fillIn: 0, essay: 0 },
          tags: []
        })
      }
    });
    res.status(201).json({ success: true, data: newQuiz });
  } catch (error) {
    console.error('Lỗi tạo Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET: LẤY DANH SÁCH SINH VIÊN ĐĂNG KÝ
const getEnrollments = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const requestedCourseId = req.query.courseId === undefined
      ? null
      : Number(req.query.courseId);
    if (
      req.query.courseId !== undefined &&
      (!Number.isSafeInteger(requestedCourseId) || requestedCourseId <= 0)
    ) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const courses = await prisma.courses.findMany({
      where: { InstructorID: teacherId },
      orderBy: { Title: 'asc' },
      select: { CourseID: true, Title: true }
    });
    if (requestedCourseId && !courses.some((course) => course.CourseID === requestedCourseId)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }
    // Lấy tất cả enrollments thuộc về các khóa học do giảng viên này dạy
    const enrollments = await prisma.enrollments.findMany({
      where: {
        ...(requestedCourseId ? { CourseID: requestedCourseId } : {}),
        Courses: { InstructorID: teacherId }
      },
      include: {
        Users: { select: { FullName: true, Email: true, StudentID: true } },
        Courses: { select: { CourseID: true, Title: true } }
      },
      orderBy: { EnrolledAt: 'desc' } // Mới nhất lên đầu
    });

    // Format lại dữ liệu cho Frontend dễ dùng
    const formattedData = enrollments.map(en => ({
      id: en.EnrollmentID,
      studentUserId: en.UserID,
      studentName: en.Users?.FullName || 'Chưa cập nhật',
      email: en.Users?.Email,
      studentId: en.Users?.StudentID || 'Chưa có MSSV',
      courseId: en.CourseID,
      courseTitle: en.Courses?.Title,
      status: en.Status,
      enrollmentDate: en.EnrolledAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      courses: courses.map((course) => ({ id: course.CourseID, title: course.Title }))
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đăng ký:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const addStudentToCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId.trim() : '';
    if (!Number.isInteger(courseId) || courseId <= 0 || !studentId) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã sinh viên hợp lệ.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học thuộc quyền quản lý của bạn.' });
    }

    const user = await prisma.users.findUnique({
      where: { StudentID: studentId },
      select: {
        UserID: true,
        Roles: { select: { RoleName: true } }
      }
    });
    if (!user || !['student', 'sinh vien'].includes(
      String(user.Roles.RoleName || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    )) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên theo mã sinh viên.' });
    }

    const existing = await prisma.enrollments.findUnique({
      where: { UserID_CourseID: { UserID: user.UserID, CourseID: courseId } },
      select: { EnrollmentID: true, Status: true }
    });
    if (existing?.Status === 'Active') {
      return res.status(409).json({ success: false, message: 'Học viên đã có quyền truy cập khóa học này.' });
    }

    const enrollment = existing
      ? await prisma.enrollments.update({
          where: { EnrollmentID: existing.EnrollmentID },
          data: { Status: 'Active' }
        })
      : await prisma.enrollments.create({
          data: { UserID: user.UserID, CourseID: courseId, Status: 'Active' }
        });
    return res.status(200).json({
      success: true,
      message: 'Đã thêm học viên vào khóa học.',
      data: { id: enrollment.EnrollmentID, status: enrollment.Status }
    });
  } catch (error) {
    console.error('Lỗi thêm học viên vào khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm học viên vào khóa học.' });
  }
};

const removeStudentFromCourse = async (req, res) => {
  try {
    const enrollmentId = Number(req.params.id);
    if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ success: false, message: 'ID ghi danh không hợp lệ.' });
    }
    const enrollment = await prisma.enrollments.findFirst({
      where: {
        EnrollmentID: enrollmentId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { EnrollmentID: true, Status: true }
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ghi danh thuộc khóa học của bạn.' });
    }
    if (enrollment.Status === 'Removed') {
      return res.status(409).json({ success: false, message: 'Học viên đã bị thu hồi quyền truy cập khóa học.' });
    }
    await prisma.enrollments.update({
      where: { EnrollmentID: enrollmentId },
      data: { Status: 'Removed' }
    });
    return res.status(200).json({
      success: true,
      message: 'Đã thu hồi quyền truy cập; lịch sử học tập được giữ nguyên.'
    });
  } catch (error) {
    console.error('Lỗi thu hồi học viên khỏi khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể thu hồi quyền truy cập học viên.' });
  }
};

const getEssayAttempts = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const attempts = await prisma.testAttempts.findMany({
      where: {
        GradingStatus: { in: ['Pending', 'Draft'] },
        Exercises: {
          Type: 'Quiz',
          Lessons: { Chapters: { Courses: { InstructorID: teacherId } } }
        },
        Submissions: {
          some: { TestQuestions: { QuestionType: 'essay' } }
        }
      },
      include: {
        Users: { select: { FullName: true, Email: true, StudentID: true } },
        Exercises: {
          select: {
            Title: true,
            MaxScore: true,
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
        Submissions: {
          where: { TestQuestions: { QuestionType: 'essay' } },
          orderBy: { SubmissionID: 'asc' },
          include: {
            TestQuestions: { select: { Content: true, Points: true } }
          }
        }
      },
      orderBy: { StartTime: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: attempts.map((attempt) => ({
        attemptId: attempt.AttemptID,
        status: attempt.GradingStatus,
        submittedAt: attempt.EndTime || attempt.StartTime,
        currentScore: Number(attempt.TotalScore),
        maxScore: Number(attempt.Exercises.MaxScore) || 10,
        feedback: attempt.InstructorFeedback || '',
        student: {
          name: attempt.Users.FullName,
          email: attempt.Users.Email,
          studentId: attempt.Users.StudentID
        },
        quizTitle: attempt.Exercises.Title,
        courseName: attempt.Exercises.Lessons?.Chapters?.Courses?.Title || '',
        chapterName: attempt.Exercises.Lessons?.Chapters?.Title || '',
        lessonName: attempt.Exercises.Lessons?.Title || '',
        questions: attempt.Submissions.map((submission) => {
          let answer = submission.CodeSubmitted;
          if (typeof answer === 'string') {
            try {
              const snapshot = JSON.parse(answer);
              if (snapshot && typeof snapshot === 'object') answer = snapshot.answer ?? '';
            } catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
            }
          }
          return {
            submissionId: submission.SubmissionID,
            question: submission.TestQuestions.Content,
            answer: typeof answer === 'string' ? answer : '',
            maxPoints: Number(submission.TestQuestions.Points),
            score: Number(submission.ScoreEarned)
          };
        })
      }))
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách bài tự luận chờ chấm:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const gradeEssayAttempt = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const attemptId = Number.parseInt(req.params.attemptId, 10);
    const { action, feedback, questions } = req.body;

    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return res.status(400).json({ success: false, message: 'Lượt làm bài không hợp lệ' });
    }
    if (!['Draft', 'Published'].includes(action) || typeof feedback !== 'string' || !Array.isArray(questions)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu chấm bài không hợp lệ' });
    }

    const attempt = await prisma.testAttempts.findFirst({
      where: {
        AttemptID: attemptId,
        GradingStatus: { in: ['Pending', 'Draft'] },
        Exercises: {
          Type: 'Quiz',
          Lessons: { Chapters: { Courses: { InstructorID: teacherId } } }
        },
        Submissions: { some: { TestQuestions: { QuestionType: 'essay' } } }
      },
      include: {
        Exercises: { select: { MaxScore: true, QuizConfig: true } },
        Submissions: {
          include: { TestQuestions: { select: { QuestionType: true, Points: true } } }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lượt tự luận cần chấm' });
    }

    const essaySubmissions = attempt.Submissions.filter(
      (submission) => submission.TestQuestions.QuestionType === 'essay'
    );
    const submittedGrades = new Map();
    for (const grade of questions) {
      const submissionId = Number(grade.submissionId);
      const score = Number(grade.score);
      const submission = essaySubmissions.find((item) => item.SubmissionID === submissionId);
      if (
        !submission ||
        submittedGrades.has(submissionId) ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > Number(submission.TestQuestions.Points)
      ) {
        return res.status(400).json({ success: false, message: 'Điểm câu tự luận không hợp lệ' });
      }
      submittedGrades.set(submissionId, score);
    }

    if (action === 'Published' && essaySubmissions.some((submission) => !submittedGrades.has(submission.SubmissionID))) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập điểm cho tất cả câu tự luận trước khi công bố' });
    }

    const savedAttempt = await prisma.$transaction(async (tx) => {
      for (const [submissionId, score] of submittedGrades) {
        const submission = essaySubmissions.find((item) => item.SubmissionID === submissionId);
        await tx.submissions.update({
          where: { SubmissionID: submissionId },
          data: {
            ScoreEarned: score,
            IsCorrect: score >= Number(submission.TestQuestions.Points)
          }
        });
      }

      const updatedSubmissions = submittedGrades.size
        ? await tx.submissions.findMany({
            where: { AttemptID: attemptId },
            include: { TestQuestions: { select: { Points: true } } }
          })
        : attempt.Submissions;
      const totalPossiblePoints = updatedSubmissions.reduce(
        (sum, submission) => sum + Number(submission.TestQuestions.Points),
        0
      );
      const earnedPoints = updatedSubmissions.reduce(
        (sum, submission) => sum + Number(submission.ScoreEarned),
        0
      );
      const maxScore = Number(attempt.Exercises.MaxScore) || 10;
      const totalScore = totalPossiblePoints > 0
        ? Number(((earnedPoints / totalPossiblePoints) * maxScore).toFixed(2))
        : 0;

      return tx.testAttempts.update({
        where: { AttemptID: attemptId },
        data: {
          TotalScore: totalScore,
          InstructorFeedback: feedback,
          GradingStatus: action
        },
        select: { AttemptID: true, TotalScore: true, GradingStatus: true }
      });
    });

    res.status(200).json({
      success: true,
      message: action === 'Published' ? 'Đã công bố kết quả chấm bài' : 'Đã lưu bản nháp chấm bài',
      data: {
        attemptId: savedAttempt.AttemptID,
        totalScore: Number(savedAttempt.TotalScore),
        gradingStatus: savedAttempt.GradingStatus
      }
    });
  } catch (error) {
    console.error('Lỗi lưu kết quả chấm tự luận:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getNotificationCourses = async (req, res) => {
  try {
    const courses = await prisma.courses.findMany({
      where: { InstructorID: req.user.userId },
      select: {
        CourseID: true,
        Title: true,
        _count: { select: { Enrollments: { where: { Status: 'Active' } } } }
      },
      orderBy: { Title: 'asc' }
    });
    res.status(200).json({
      success: true,
      data: courses.map((course) => ({
        id: course.CourseID,
        title: course.Title,
        activeStudentCount: course._count.Enrollments
      }))
    });
  } catch (error) {
    console.error('Lỗi lấy khóa học gửi thông báo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getNotificationRecipients = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });

    const enrollments = await prisma.enrollments.findMany({
      where: { CourseID: courseId, Status: 'Active' },
      select: {
        UserID: true,
        Users: { select: { FullName: true, Email: true, StudentID: true } }
      },
      orderBy: { Users: { FullName: 'asc' } }
    });
    res.status(200).json({
      success: true,
      data: enrollments.map((enrollment) => ({
        id: enrollment.UserID,
        name: enrollment.Users.FullName,
        email: enrollment.Users.Email,
        studentId: enrollment.Users.StudentID
      }))
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách người nhận thông báo:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const sendCourseNotification = async (req, res) => {
  try {
    const courseId = Number(req.body.courseId);
    const { title, message, recipientIds, notificationType, actionLabel, actionUrl } = req.body;
    const allowedNotificationTypes = ['AI', 'Quiz', 'Lesson', 'Exercise', 'Course', 'General'];
    const hasActionLabel = actionLabel !== undefined && actionLabel !== null;
    const hasActionUrl = actionUrl !== undefined && actionUrl !== null;
    const hasAction = hasActionLabel && hasActionUrl;
    if (
      !Number.isInteger(courseId) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 200 ||
      typeof message !== 'string' ||
      !message.trim() ||
      !Array.isArray(recipientIds) ||
      !allowedNotificationTypes.includes(notificationType) ||
      (hasActionLabel !== hasActionUrl) ||
      (hasAction && (
        typeof actionLabel !== 'string' ||
        !actionLabel.trim() ||
        actionLabel.trim().length > 100 ||
        typeof actionUrl !== 'string' ||
        actionUrl.length > 500 ||
        !/^\/student(?:\/[a-zA-Z0-9_-]+)*(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(actionUrl)
      ))
    ) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung, loại thông báo và người nhận hợp lệ' });
    }

    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, InstructorID: req.user.userId },
      select: { CourseID: true }
    });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });

    const userIds = [...new Set(recipientIds.map(Number))];
    if (!userIds.length || userIds.some((userId) => !Number.isInteger(userId) || userId <= 0)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một học viên hợp lệ' });
    }

    const activeEnrollments = await prisma.enrollments.findMany({
      where: { CourseID: courseId, Status: 'Active', UserID: { in: userIds } },
      select: { UserID: true }
    });
    if (activeEnrollments.length !== userIds.length) {
      return res.status(400).json({ success: false, message: 'Danh sách người nhận có học viên không thuộc lớp đang hoạt động' });
    }

    const created = await prisma.notifications.createMany({
      data: userIds.map((userId) => ({
        UserID: userId,
        Title: title.trim(),
        Message: message.trim(),
        NotificationType: notificationType,
        ActionLabel: hasAction ? actionLabel.trim() : null,
        ActionUrl: hasAction ? actionUrl : null
      }))
    });
    res.status(201).json({
      success: true,
      message: `Đã gửi thông báo đến ${created.count} học viên`,
      data: { recipientCount: created.count }
    });
  } catch (error) {
    console.error('Lỗi gửi thông báo khóa học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT: DUYỆT HOẶC TỪ CHỐI ĐĂNG KÝ
const updateEnrollmentStatus = async (req, res) => {
  try {
    const enrollmentId = Number.parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (
      !Number.isInteger(enrollmentId) ||
      enrollmentId <= 0 ||
      !['Active', 'Rejected'].includes(status)
    ) {
      return res.status(400).json({ success: false, message: 'Thông tin cập nhật ghi danh không hợp lệ.' });
    }

    const enrollment = await prisma.enrollments.findFirst({
      where: {
        EnrollmentID: enrollmentId,
        Courses: { InstructorID: req.user.userId }
      },
      select: { EnrollmentID: true }
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ghi danh thuộc khóa học của bạn.' });
    }

    await prisma.enrollments.update({
      where: { EnrollmentID: enrollmentId },
      data: { Status: status }
    });

    res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái đăng ký:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getTeacherDashboard,
  getTeacherStudentProgress,
  getTeacherLayoutData,
  getTeacherCourseManagement,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse,
  createChapter,
  createLesson,
  updateLessonStatus,
  updateChapter,
  deleteChapter,
  updateLesson,
  uploadLessonSlide,
  getTeacherLessonSlide,
  deleteLesson,
  createExercise,
  deleteExercise,
  getTeacherExercises,
  getQuestionBank,
  createQuestionBankQuestion,
  updateQuestionBankQuestion,
  deleteQuestionBankQuestion,
  updateExerciseDetails,
  getTeacherQuizzes, 
  getTeacherQuizAttempts,
  getTeacherQuizAttemptDetail,
  createQuiz,
  reorderChapters,
  reorderLessons,
  getEnrollments,
  addStudentToCourse,
  removeStudentFromCourse,
  updateEnrollmentStatus,
  getEssayAttempts,
  gradeEssayAttempt,
  getNotificationCourses,
  getNotificationRecipients,
  sendCourseNotification
};