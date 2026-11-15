const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizeText = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const getAdminDashboard = async (req, res) => {
  try {
    const activityDays = Array.from({ length: 7 }, (_, index) => {
      const start = new Date();
      start.setDate(start.getDate() - (6 - index));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        start,
        end,
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
        name: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(start)
      };
    });
    const [
      roles,
      roleGroups,
      courses,
      aiRequests,
      avgMasteryResult,
      ...activityCounts
    ] = await Promise.all([
      prisma.roles.findMany({ select: { RoleID: true, RoleName: true } }),
      prisma.users.groupBy({ by: ['RoleID'], _count: { _all: true } }),
      prisma.courses.count(),
      prisma.aIGenerations.count(),
      prisma.studentTopicProgress.aggregate({ _avg: { MasteryLevel: true } }),
      ...activityDays.map((day) => prisma.learningActivities.count({
        where: { CreatedAt: { gte: day.start, lt: day.end } }
      }))
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [todayGenerations, recentLogs] = await Promise.all([
      prisma.aIGenerations.findMany({
        where: { GeneratedAt: { gte: todayStart } },
        select: { GeneratedAt: true }
      }),
      prisma.learningActivities.findMany({
        take: 5,
        orderBy: { CreatedAt: 'desc' },
        include: {
          Users: { select: { FullName: true } },
          Exercises: { select: { Title: true } },
          Lessons: { select: { Title: true } }
        }
      })
    ]);

    const roleNames = new Map(roles.map((role) => [role.RoleID, normalizeText(role.RoleName)]));
    const roleCounts = { totalUsers: 0, students: 0, instructors: 0 };
    for (const group of roleGroups) {
      const count = group._count._all;
      const roleName = roleNames.get(group.RoleID) || '';
      roleCounts.totalUsers += count;
      if (['student', 'hoc vien', 'sinh vien'].includes(roleName)) roleCounts.students += count;
      if (['teacher', 'instructor', 'giang vien'].includes(roleName)) roleCounts.instructors += count;
    }

    const userActivityData = activityDays.map((day, index) => ({
      key: day.key,
      name: day.name,
      actions: activityCounts[index]
    }));

    const hoursMap = { '6h': 0, '8h': 0, '10h': 0, '12h': 0, '14h': 0, '16h': 0, '18h': 0, '20h': 0, '22h': 0 };
    for (const generation of todayGenerations) {
      const hour = new Date(generation.GeneratedAt).getHours();
      const bucket = hour <= 6 ? '6h'
        : hour <= 8 ? '8h'
          : hour <= 10 ? '10h'
            : hour <= 12 ? '12h'
              : hour <= 14 ? '14h'
                : hour <= 16 ? '16h'
                  : hour <= 18 ? '18h'
                    : hour <= 20 ? '20h'
                      : '22h';
      hoursMap[bucket] += 1;
    }

    const activityLogs = recentLogs.map((log) => {
      let actionDesc = 'vừa có hoạt động học tập mới';
      if (log.ActionType === 'Submit Code' || log.ActionType === 'Submit Quiz') {
        actionDesc = `vừa nộp bài: ${log.Exercises?.Title || ''}${log.Score === null ? '' : ` (Điểm: ${log.Score})`}`;
      } else if (log.ActionType === 'LessonCompleted' && log.LessonID) {
        actionDesc = `vừa hoàn thành bài học: ${log.Lessons?.Title || ''}`;
      }
      return {
        message: `${log.Users?.FullName || 'Học viên'} ${actionDesc}`,
        time: log.CreatedAt
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          ...roleCounts,
          courses,
          aiRequests,
          aiRequestsToday: todayGenerations.length,
          avgMastery: Math.round(Number(avgMasteryResult._avg.MasteryLevel || 0))
        },
        userActivityData,
        aiRequestsData: Object.keys(hoursMap).map((time) => ({ time, reqs: hoursMap[time] })),
        activityLogs,
        telemetry: {
          pageViewsAvailable: false,
          apiPerformanceAvailable: false
        }
      }
    });
  } catch (error) {
    console.error('Lỗi lấy Admin Dashboard:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu thống kê' });
  }
};

module.exports = { getAdminDashboard };
