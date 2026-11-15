const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const periods = ['week', 'month', 'year'];

const normalizeText = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const parseCourseId = (value) => {
  if (value === undefined || value === '') return null;
  const courseId = Number(value);
  return Number.isInteger(courseId) && courseId > 0 ? courseId : NaN;
};

const getDateRange = async (period) => {
  const [clock] = await prisma.$queryRaw`SELECT SYSDATETIME() AS currentDateTime`;
  const end = clock.currentDateTime;
  const start = new Date(end);

  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
    start.setUTCHours(0, 0, 0, 0);
  }

  return { start, end };
};

const dateKey = (date, period) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (period === 'year') return `${year}-${month}`;
  return `${year}-${month}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const makeBuckets = (period, start) => {
  const count = period === 'week' ? 7 : period === 'month' ? 30 : 12;
  const buckets = [];
  const current = new Date(start);

  if (period === 'year') current.setUTCDate(1);
  for (let index = 0; index < count; index += 1) {
    const date = new Date(current);
    buckets.push({
      key: dateKey(date, period),
      label: new Intl.DateTimeFormat('vi-VN', period === 'year'
        ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
        : { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date),
      enrollments: 0,
      learningActivities: 0,
      quizAttempts: 0,
      aiRoadmaps: 0
    });
    if (period === 'year') current.setUTCMonth(current.getUTCMonth() + 1);
    else current.setUTCDate(current.getUTCDate() + 1);
  }

  return buckets;
};

const addGroupedCounts = (bucketsByKey, rows, dateField, countField, period) => {
  for (const row of rows) {
    const key = dateKey(row[dateField], period);
    const bucket = bucketsByKey.get(key);
    if (bucket) bucket[countField] += row._count._all;
  }
};

const getAnalyticsDetails = async (req, res) => {
  try {
    const metric = String(req.query.metric || '');
    const page = Number(req.query.page || 1);
    const pageSize = 25;
    const courseId = parseCourseId(req.query.courseId);
    const period = String(req.query.period || 'month');

    if (!['users', 'courses', 'enrollments', 'activities', 'quizzes', 'quizAttempts', 'aiRoadmaps'].includes(metric)) {
      return res.status(400).json({ success: false, message: 'Loại thống kê chi tiết không hợp lệ.' });
    }
    if (!Number.isSafeInteger(page) || page < 1 || Number.isNaN(courseId)) {
      return res.status(400).json({ success: false, message: 'Bộ lọc thống kê chi tiết không hợp lệ.' });
    }
    if (!periods.includes(period)) {
      return res.status(400).json({ success: false, message: 'Khoảng thời gian thống kê không hợp lệ.' });
    }

    const skip = (page - 1) * pageSize;
    const { start, end } = await getDateRange(period);
    const dateFilter = { gte: start, lte: end };
    let columns;
    let items;
    let total;

    if (metric === 'users') {
      const where = {};
      [items, total] = await Promise.all([
        prisma.users.findMany({
          where,
          include: { Roles: { select: { RoleName: true } } },
          orderBy: { CreatedAt: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.users.count({ where })
      ]);
      columns = [
        { key: 'name', label: 'Người dùng' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Vai trò' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'createdAt', label: 'Ngày tạo' }
      ];
      items = items.map((user) => ({
        id: user.UserID,
        name: user.FullName,
        email: user.Email,
        role: user.Roles.RoleName,
        status: user.IsActive ? 'Đang hoạt động' : 'Đã khóa',
        createdAt: user.CreatedAt
      }));
    } else if (metric === 'courses') {
      const where = courseId ? { CourseID: courseId } : {};
      [items, total] = await Promise.all([
        prisma.courses.findMany({
          where,
          include: {
            Users: { select: { FullName: true, Email: true } },
            Categories: { select: { CategoryName: true } },
            _count: { select: { Enrollments: { where: { Status: 'Active' } } } }
          },
          orderBy: { CreatedAt: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.courses.count({ where })
      ]);
      columns = [
        { key: 'title', label: 'Khóa học' },
        { key: 'instructor', label: 'Giảng viên' },
        { key: 'category', label: 'Danh mục' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'students', label: 'Học viên active' },
        { key: 'createdAt', label: 'Ngày tạo' }
      ];
      items = items.map((course) => ({
        id: course.CourseID,
        title: course.Title,
        instructor: course.Users.FullName || course.Users.Email,
        category: course.Categories.CategoryName,
        status: course.Status,
        students: course._count.Enrollments,
        createdAt: course.CreatedAt
      }));
    } else if (metric === 'enrollments') {
      const where = {
        EnrolledAt: dateFilter,
        ...(courseId ? { CourseID: courseId } : {})
      };
      [items, total] = await Promise.all([
        prisma.enrollments.findMany({
          where,
          include: {
            Users: { select: { FullName: true, Email: true, StudentID: true } },
            Courses: { select: { Title: true } }
          },
          orderBy: { EnrolledAt: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.enrollments.count({ where })
      ]);
      columns = [
        { key: 'student', label: 'Học viên' },
        { key: 'studentId', label: 'MSSV' },
        { key: 'course', label: 'Khóa học' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'progress', label: 'Tiến độ' },
        { key: 'enrolledAt', label: 'Ngày ghi danh' }
      ];
      items = items.map((enrollment) => ({
        id: enrollment.EnrollmentID,
        student: enrollment.Users.FullName || enrollment.Users.Email,
        studentId: enrollment.Users.StudentID || '',
        course: enrollment.Courses.Title,
        status: enrollment.Status,
        progress: Number(enrollment.ProgressPercent),
        enrolledAt: enrollment.EnrolledAt
      }));
    } else if (metric === 'activities') {
      const where = {
        CreatedAt: dateFilter,
        ...(courseId ? { CourseID: courseId } : {})
      };
      [items, total] = await Promise.all([
        prisma.learningActivities.findMany({
          where,
          include: {
            Users: { select: { FullName: true, Email: true } },
            Courses: { select: { Title: true } },
            Lessons: { select: { Title: true } },
            Exercises: { select: { Title: true } }
          },
          orderBy: { CreatedAt: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.learningActivities.count({ where })
      ]);
      columns = [
        { key: 'student', label: 'Người dùng' },
        { key: 'course', label: 'Khóa học' },
        { key: 'action', label: 'Hoạt động' },
        { key: 'content', label: 'Nội dung' },
        { key: 'timeSpent', label: 'Thời gian (giây)' },
        { key: 'score', label: 'Điểm' },
        { key: 'createdAt', label: 'Thời điểm' }
      ];
      items = items.map((activity) => ({
        id: String(activity.ActivityID),
        student: activity.Users.FullName || activity.Users.Email,
        course: activity.Courses.Title,
        action: activity.ActionType || '',
        content: activity.Lessons?.Title || activity.Exercises?.Title || '',
        timeSpent: activity.TimeSpentSeconds,
        score: activity.Score === null ? '' : Number(activity.Score),
        createdAt: activity.CreatedAt
      }));
    } else if (metric === 'quizzes') {
      const where = {
        Type: 'Quiz',
        ...(courseId ? { Lessons: { is: { Chapters: { CourseID: courseId } } } } : {})
      };
      [items, total] = await Promise.all([
        prisma.exercises.findMany({
          where,
          include: {
            Lessons: {
              select: {
                Title: true,
                Chapters: { select: { Courses: { select: { Title: true } } } }
              }
            },
            _count: { select: { TestQuestions: true } }
          },
          orderBy: { Title: 'asc' },
          skip,
          take: pageSize
        }),
        prisma.exercises.count({ where })
      ]);
      columns = [
        { key: 'title', label: 'Bài kiểm tra' },
        { key: 'course', label: 'Khóa học' },
        { key: 'lesson', label: 'Bài học' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'questionCount', label: 'Số câu hỏi' },
        { key: 'maxScore', label: 'Điểm tối đa' }
      ];
      items = items.map((quiz) => ({
        id: quiz.ExerciseID,
        title: quiz.Title,
        course: quiz.Lessons?.Chapters.Courses.Title || '',
        lesson: quiz.Lessons?.Title || '',
        status: quiz.Status,
        questionCount: quiz._count.TestQuestions,
        maxScore: Number(quiz.MaxScore)
      }));
    } else if (metric === 'quizAttempts') {
      const where = {
        StartTime: dateFilter,
        Exercises: {
          Type: 'Quiz',
          ...(courseId ? { Lessons: { is: { Chapters: { CourseID: courseId } } } } : {})
        }
      };
      [items, total] = await Promise.all([
        prisma.testAttempts.findMany({
          where,
          include: {
            Users: { select: { FullName: true, Email: true, StudentID: true } },
            Exercises: { select: { Title: true, MaxScore: true } }
          },
          orderBy: { StartTime: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.testAttempts.count({ where })
      ]);
      columns = [
        { key: 'student', label: 'Học viên' },
        { key: 'studentId', label: 'MSSV' },
        { key: 'quiz', label: 'Bài kiểm tra' },
        { key: 'score', label: 'Điểm' },
        { key: 'maxScore', label: 'Điểm tối đa' },
        { key: 'gradingStatus', label: 'Trạng thái chấm' },
        { key: 'startedAt', label: 'Bắt đầu' },
        { key: 'submittedAt', label: 'Nộp bài' }
      ];
      items = items.map((attempt) => ({
        id: attempt.AttemptID,
        student: attempt.Users.FullName || attempt.Users.Email,
        studentId: attempt.Users.StudentID || '',
        quiz: attempt.Exercises.Title,
        score: Number(attempt.TotalScore),
        maxScore: Number(attempt.Exercises.MaxScore),
        gradingStatus: attempt.GradingStatus || '',
        startedAt: attempt.StartTime,
        submittedAt: attempt.EndTime
      }));
    } else {
      const where = {
        CreatedAt: dateFilter,
        ...(courseId ? { CourseID: courseId } : {})
      };
      [items, total] = await Promise.all([
        prisma.learningPaths.findMany({
          where,
          include: {
            Users: { select: { FullName: true, Email: true, StudentID: true } },
            Courses: { select: { Title: true } },
            AIGenerations: { select: { Provider: true, ModelName: true, Status: true, ProcessingTimeMs: true } }
          },
          orderBy: { CreatedAt: 'desc' },
          skip,
          take: pageSize
        }),
        prisma.learningPaths.count({ where })
      ]);
      columns = [
        { key: 'student', label: 'Học viên' },
        { key: 'studentId', label: 'MSSV' },
        { key: 'course', label: 'Khóa học' },
        { key: 'title', label: 'Lộ trình' },
        { key: 'provider', label: 'Provider' },
        { key: 'model', label: 'Model' },
        { key: 'generationStatus', label: 'Trạng thái sinh AI' },
        { key: 'processingTime', label: 'Thời gian xử lý (ms)' },
        { key: 'createdAt', label: 'Thời điểm' }
      ];
      items = items.map((path) => ({
        id: path.PathID,
        student: path.Users.FullName || path.Users.Email,
        studentId: path.Users.StudentID || '',
        course: path.Courses.Title,
        title: path.Title || '',
        provider: path.AIGenerations.Provider || '',
        model: path.AIGenerations.ModelName || '',
        generationStatus: path.AIGenerations.Status || '',
        processingTime: path.AIGenerations.ProcessingTimeMs ?? '',
        createdAt: path.CreatedAt
      }));
    }

    return res.json({
      success: true,
      data: { metric, page, pageSize, total, columns, items }
    });
  } catch (error) {
    console.error('Không thể tải chi tiết Analytics quản trị:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách chi tiết thống kê.'
    });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const period = String(req.query.period || 'month');
    const courseId = parseCourseId(req.query.courseId);

    if (!periods.includes(period)) {
      return res.status(400).json({ success: false, message: 'Khoảng thời gian thống kê không hợp lệ.' });
    }
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ success: false, message: 'Khóa học lọc không hợp lệ.' });
    }

    const { start, end } = await getDateRange(period);
    const dateFilter = { gte: start, lte: end };
    const enrollmentWhere = {
      EnrolledAt: dateFilter,
      ...(courseId ? { CourseID: courseId } : {})
    };
    const activityWhere = {
      CreatedAt: dateFilter,
      ...(courseId ? { CourseID: courseId } : {})
    };
    const quizAttemptWhere = {
      StartTime: dateFilter,
      Exercises: {
        Type: 'Quiz',
        ...(courseId ? { Lessons: { is: { Chapters: { CourseID: courseId } } } } : {})
      }
    };
    const aiRoadmapWhere = {
      CreatedAt: dateFilter,
      ...(courseId ? { CourseID: courseId } : {})
    };

    const [
      roleGroups,
      roles,
      totalCourses,
      publishedCourses,
      courses,
      enrollmentCount,
      activeEnrollmentCount,
      completedEnrollmentCount,
      enrollmentTrend,
      activityCount,
      activityTrend,
      quizCount,
      quizAttemptCount,
      quizAttemptTrend,
      aiRoadmapCount,
      aiRoadmapTrend
    ] = await Promise.all([
      prisma.users.groupBy({ by: ['RoleID'], _count: { _all: true } }),
      prisma.roles.findMany({ select: { RoleID: true, RoleName: true } }),
      prisma.courses.count(),
      prisma.courses.count({ where: { Status: 'Published' } }),
      prisma.courses.findMany({
        select: { CourseID: true, Title: true },
        orderBy: { Title: 'asc' }
      }),
      prisma.enrollments.count({ where: enrollmentWhere }),
      prisma.enrollments.count({
        where: { ...enrollmentWhere, Status: 'Active' }
      }),
      prisma.enrollments.count({
        where: { ...enrollmentWhere, Status: 'Active', ProgressPercent: { gte: 100 } }
      }),
      prisma.enrollments.groupBy({
        by: ['EnrolledAt'],
        where: enrollmentWhere,
        _count: { _all: true }
      }),
      prisma.learningActivities.count({ where: activityWhere }),
      prisma.learningActivities.groupBy({
        by: ['CreatedAt'],
        where: activityWhere,
        _count: { _all: true }
      }),
      prisma.exercises.count({
        where: {
          Type: 'Quiz',
          ...(courseId ? { Lessons: { is: { Chapters: { CourseID: courseId } } } } : {})
        }
      }),
      prisma.testAttempts.count({ where: quizAttemptWhere }),
      prisma.testAttempts.groupBy({
        by: ['StartTime'],
        where: quizAttemptWhere,
        _count: { _all: true }
      }),
      prisma.learningPaths.count({ where: aiRoadmapWhere }),
      prisma.learningPaths.groupBy({
        by: ['CreatedAt'],
        where: aiRoadmapWhere,
        _count: { _all: true }
      })
    ]);

    const roleNames = new Map(roles.map((role) => [role.RoleID, normalizeText(role.RoleName)]));
    const userCounts = { total: 0, administrators: 0, instructors: 0, students: 0 };
    for (const group of roleGroups) {
      const count = group._count._all;
      const roleName = roleNames.get(group.RoleID) || '';
      userCounts.total += count;
      if (['admin', 'quan tri vien'].includes(roleName)) userCounts.administrators += count;
      else if (['teacher', 'instructor', 'giang vien'].includes(roleName)) userCounts.instructors += count;
      else if (['student', 'hoc vien', 'sinh vien'].includes(roleName)) userCounts.students += count;
    }

    const trend = makeBuckets(period, start);
    const bucketsByKey = new Map(trend.map((bucket) => [bucket.key, bucket]));
    addGroupedCounts(bucketsByKey, enrollmentTrend, 'EnrolledAt', 'enrollments', period);
    addGroupedCounts(bucketsByKey, activityTrend, 'CreatedAt', 'learningActivities', period);
    addGroupedCounts(bucketsByKey, quizAttemptTrend, 'StartTime', 'quizAttempts', period);
    addGroupedCounts(bucketsByKey, aiRoadmapTrend, 'CreatedAt', 'aiRoadmaps', period);

    const selectedCourse = courseId ? courses.find((course) => course.CourseID === courseId) : null;
    if (courseId && !selectedCourse) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học được chọn.' });
    }

    return res.json({
      success: true,
      data: {
        period,
        range: { start: start.toISOString(), end: end.toISOString() },
        selectedCourseId: courseId,
        courses: courses.map((course) => ({ id: course.CourseID, title: course.Title })),
        summary: {
          users: userCounts,
          courses: { total: totalCourses, published: publishedCourses },
          enrollments: enrollmentCount,
          activeEnrollments: activeEnrollmentCount,
          completedEnrollments: completedEnrollmentCount,
          completionRate: activeEnrollmentCount
            ? Math.round((completedEnrollmentCount / activeEnrollmentCount) * 1000) / 10
            : 0,
          learningActivities: activityCount,
          quizzes: quizCount,
          quizAttempts: quizAttemptCount,
          aiRoadmaps: aiRoadmapCount
        },
        trend
      }
    });
  } catch (error) {
    console.error('Không thể tải dữ liệu Analytics quản trị:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải dữ liệu Dashboard hệ thống. Vui lòng thử lại sau.'
    });
  }
};

module.exports = { getAnalytics, getAnalyticsDetails };
