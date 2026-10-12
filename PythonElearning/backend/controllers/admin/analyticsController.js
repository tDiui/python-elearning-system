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

const getDateRange = (period) => {
  const end = new Date();
  const start = new Date(end);

  if (period === 'week') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

const dateKey = (date, period) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (period === 'year') return `${year}-${month}`;
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
};

const makeBuckets = (period, start) => {
  const count = period === 'week' ? 7 : period === 'month' ? 30 : 12;
  const buckets = [];
  const current = new Date(start);

  if (period === 'year') current.setDate(1);
  for (let index = 0; index < count; index += 1) {
    const date = new Date(current);
    buckets.push({
      key: dateKey(date, period),
      label: new Intl.DateTimeFormat('vi-VN', period === 'year'
        ? { month: 'short', year: '2-digit' }
        : { day: '2-digit', month: '2-digit' }).format(date),
      enrollments: 0,
      learningActivities: 0,
      quizAttempts: 0,
      aiRoadmaps: 0
    });
    if (period === 'year') current.setMonth(current.getMonth() + 1);
    else current.setDate(current.getDate() + 1);
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

    const { start, end } = getDateRange(period);
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

module.exports = { getAnalytics };
