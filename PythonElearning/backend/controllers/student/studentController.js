const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const { updateTopicProgress } = require('../../services/learningProgressService');
const { getLessonSlidePath } = require('../../utils/lessonSlides');

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

const buildDashboardInsight = ({
  currentCourse,
  knowledgeMap,
  avgScore,
  hasScoreData,
  totalStudySeconds
}) => {
  const weakestTopic = knowledgeMap
    .filter((topic) => topic.warning)
    .sort((a, b) => a.score - b.score)[0];
  if (weakestTopic) {
    return `Chủ đề "${weakestTopic.name}" đang ở mức ${weakestTopic.score}%. Hãy ôn lại nội dung và làm thêm bài tập thuộc chủ đề này.`;
  }

  if (currentCourse?.totalLessons > 0) {
    if (currentCourse.completedLessons === currentCourse.totalLessons) {
      return `Bạn đã hoàn thành ${currentCourse.completedLessons}/${currentCourse.totalLessons} bài học đã xuất bản trong khóa "${currentCourse.courseName}".`;
    }
    return `Bạn đã hoàn thành ${currentCourse.completedLessons}/${currentCourse.totalLessons} bài học đã xuất bản trong khóa "${currentCourse.courseName}". Tiếp tục với bài học kế tiếp.`;
  }

  if (hasScoreData) {
    return `Điểm trung bình hiện tại là ${avgScore}%. Tiếp tục luyện tập để củng cố kết quả.`;
  }

  if (totalStudySeconds > 0) {
    return `Hệ thống đã ghi nhận ${Math.round(totalStudySeconds / 60)} phút học. Hoàn thành một bài học hoặc làm bài tập để cập nhật tiến độ.`;
  }

  return 'Chưa có đủ dữ liệu học tập để đưa ra nhận định. Hãy bắt đầu học hoặc làm bài tập để Dashboard ghi nhận tiến độ.';
};

const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const requestedCourseId = req.query.courseId === undefined
      ? null
      : typeof req.query.courseId === 'string'
        ? Number(req.query.courseId)
        : Number.NaN;
    if (
      req.query.courseId !== undefined &&
      (!Number.isSafeInteger(requestedCourseId) || requestedCourseId <= 0)
    ) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const [user, stats, topicProgress, completedLessonActivities, activityStats, testAttempts, completedExerciseActivities, unreadNotifications, availableEnrollments, activeEnrollment] = await Promise.all([
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
      prisma.learningActivities.findMany({
        where: {
          UserID: userId,
          IsCompleted: true,
          ActionType: 'LessonCompleted',
          LessonID: { not: null },
          Lessons: { Status: 'Published' }
        },
        select: { LessonID: true }
      }),
      prisma.learningActivities.aggregate({
        where: { UserID: userId, TimeSpentSeconds: { gt: 0 } },
        _sum: { TimeSpentSeconds: true }
      }),
      prisma.testAttempts.findMany({
        where: { UserID: userId },
        select: {
          TotalScore: true,
          GradingStatus: true,
          Exercises: { select: { Type: true, MaxScore: true } }
        }
      }),
      prisma.learningActivities.findMany({
        where: {
          UserID: userId,
          IsCompleted: true,
          ActionType: 'Submit Code',
          ExerciseID: { not: null }
        },
        select: { ExerciseID: true }
      }),
      prisma.notifications.count({
        where: {
          UserID: userId,
          IsRead: false
        }
      }),
      prisma.enrollments.findMany({
        where: {
          UserID: userId,
          Status: 'Active',
          Courses: { Status: 'Published' }
        },
        orderBy: { EnrolledAt: 'asc' },
        select: {
          CourseID: true,
          Courses: { select: { Title: true } }
        }
      }),
      prisma.enrollments.findFirst({
        where: {
          UserID: userId,
          Status: 'Active',
          ...(requestedCourseId ? { CourseID: requestedCourseId } : {}),
          Courses: { Status: 'Published' }
        },
        orderBy: { EnrolledAt: 'asc' },
        include: {
          Courses: {
            select: {
              CourseID: true,
              Title: true,
              Chapters: {
                orderBy: { ChapterID: 'asc' },
                select: {
                  Title: true,
                  Lessons: {
                    where: { Status: 'Published' },
                    orderBy: { LessonID: 'asc' },
                    select: { LessonID: true, Title: true, DurationMinutes: true, Difficulty: true }
                  }
                }
              }
            }
          }
        }
      })
    ]);

    if (requestedCourseId && !activeEnrollment) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có ghi danh đang hoạt động trong khóa học này.'
      });
    }

    const statsStudySeconds = stats.reduce((sum, item) => sum + (Number(item.TotalTimeSpentSeconds) || 0), 0);
    const recordedStudySeconds = activityStats._sum?.TimeSpentSeconds;
    const totalStudySeconds = recordedStudySeconds === null || recordedStudySeconds === undefined
      ? statsStudySeconds
      : Number(recordedStudySeconds);
    const statsAverageScore = stats.length
      ? stats.reduce((sum, item) => sum + (Number(item.AverageScore) || 0), 0) / stats.length
      : 0;
    const scoredAttemptPercentages = testAttempts
      .filter((attempt) => !['Pending', 'Draft'].includes(attempt.GradingStatus))
      .map((attempt) => {
        const score = Number(attempt.TotalScore) || 0;
        const maximum = Number(attempt.Exercises.MaxScore) || 10;
        const percentage = attempt.Exercises.Type === 'Quiz' && score > 10
          ? score
          : (score / maximum) * 100;
        return Math.min(Math.max(percentage, 0), 100);
      });
    const averageScore = scoredAttemptPercentages.length
      ? scoredAttemptPercentages.reduce((sum, score) => sum + score, 0) / scoredAttemptPercentages.length
      : statsAverageScore;
    const hasScoreData = scoredAttemptPercentages.length > 0 ||
      stats.some((item) => Number(item.AverageScore) > 0);
    const overallMastery = topicProgress.length
      ? topicProgress.reduce((sum, item) => sum + (Number(item.MasteryLevel) || 0), 0) / topicProgress.length
      : 0;
    const hasMasteryData = topicProgress.length > 0;

    const knowledgeMap = topicProgress.map((item) => {
      const score = Math.min(Math.max(Number(item.MasteryLevel) || 0, 0), 100);
      return {
        name: item.KnowledgeTopics?.TopicName || 'Uncategorized Topic',
        score: Number(score.toFixed(2)),
        color: score >= 70 ? 'bg-blue-600' : score >= 50 ? 'bg-amber-500' : 'bg-red-500',
        warning: score < 50 ? 'Cần luyện tập' : undefined
      };
    });

    let currentCourse = null;
    let learningPath = [];
    let learningPathTitle = null;
    let learningPathSource = null;
    let hasLearningActivity = false;

    if (activeEnrollment?.Courses) {
      const course = activeEnrollment.Courses;
      const [courseActivities, activePath, courseLearningActivityCount] = await Promise.all([
        prisma.learningActivities.findMany({
          where: {
            UserID: userId,
            CourseID: course.CourseID,
            IsCompleted: true,
            ActionType: 'LessonCompleted',
            LessonID: { not: null },
            Lessons: { Status: 'Published' }
          },
          select: { LessonID: true }
        }),
        prisma.learningPaths.findFirst({
          where: {
            UserID: userId,
            CourseID: course.CourseID,
            Status: 'Active'
          },
          orderBy: { CreatedAt: 'desc' },
          include: {
            AIGenerations: { select: { Status: true } },
            LearningPathItems: {
              orderBy: { OrderIndex: 'asc' },
              include: {
                Lessons: {
                  select: { LessonID: true, Title: true, Difficulty: true, DurationMinutes: true, Status: true }
                },
                Exercises: {
                  select: {
                    ExerciseID: true,
                    Title: true,
                    Type: true,
                    DifficultyLevel: true,
                    TimeLimitMinutes: true,
                    Lessons: { select: { Status: true } }
                  }
                }
              }
            }
          }
        }),
        prisma.learningActivities.count({
          where: {
            UserID: userId,
            CourseID: course.CourseID,
            OR: [
              { TimeSpentSeconds: { gt: 0 } },
              { LessonID: { not: null }, ActionType: 'LessonCompleted', IsCompleted: true },
              { ExerciseID: { not: null }, ActionType: { in: ['Submit Code', 'Submit Quiz'] } }
            ]
          }
        })
      ]);
      hasLearningActivity = courseLearningActivityCount > 0;

      const lessons = course.Chapters.flatMap((chapter) =>
        chapter.Lessons.map((lesson) => ({ ...lesson, chapterTitle: chapter.Title }))
      );
      const completedLessonIds = new Set(
        courseActivities
          .map((activity) => activity.LessonID)
          .filter((lessonId) => lessonId !== null)
      );
      const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.LessonID));
      const completedCourseLessons = lessons.filter((lesson) => completedLessonIds.has(lesson.LessonID)).length;

      currentCourse = {
        courseId: course.CourseID,
        courseName: course.Title,
        chapterInfo: nextLesson?.chapterTitle || (lessons.length ? 'Đã hoàn thành các bài học hiện có' : 'Khóa học chưa có bài học'),
        progressPercent: lessons.length
          ? Number(((completedCourseLessons / lessons.length) * 100).toFixed(1))
          : 0,
        completedLessons: completedCourseLessons,
        totalLessons: lessons.length,
        nextLessonId: nextLesson?.LessonID || null
      };

      if (activePath) {
        learningPathTitle = activePath.Title || 'Lộ trình học tập cá nhân hóa';
        learningPathSource = activePath.AIGenerations.Status === 'Fallback_Used' ? 'Fallback' : 'AI';
        learningPath = activePath.LearningPathItems
          .filter((item) =>
            (!item.Lessons || item.Lessons.Status === 'Published') &&
            (!item.Exercises?.Lessons || item.Exercises.Lessons.Status === 'Published')
          )
          .map((item) => {
          const lesson = item.Lessons;
          const exercise = item.Exercises;
          const isLesson = Boolean(lesson);
          const difficulty = isLesson
            ? lesson.Difficulty || 'Medium'
            : !exercise || exercise.DifficultyLevel <= 1
              ? 'Easy'
              : exercise.DifficultyLevel === 2
                ? 'Medium'
                : 'Hard';

          return {
            id: item.PathItemID,
            title: lesson?.Title || exercise?.Title || 'Nội dung học tập',
            difficulty,
            reason: item.RecommendationReason || 'Nội dung được đề xuất trong lộ trình học tập.',
            durationMinutes: lesson?.DurationMinutes || exercise?.TimeLimitMinutes || 0,
            isCompleted: item.IsCompleted,
            isLocked: false,
            targetType: isLesson ? 'Lesson' : exercise?.Type === 'Quiz' ? 'Quiz' : 'Exercise',
            targetId: lesson?.LessonID || exercise?.ExerciseID || null
          };
          });
        learningPath = learningPath.map((item, index) => ({
          ...item,
          isLocked: index > 0 && !learningPath[index - 1].isCompleted
        }));
      }
    }

    const dashboardData = {
      fullName: user?.FullName || 'Student',
      overallMastery: Number(overallMastery.toFixed(2)),
      hasMasteryData,
      totalLessonsLearned: new Set(completedLessonActivities.map((activity) => activity.LessonID)).size,
      avgScore: Number(averageScore.toFixed(2)),
      hasScoreData,
      studyTimeHours: Number((totalStudySeconds / 3600).toFixed(1)),
      hasStudyTimeData: totalStudySeconds > 0,
      hasLearningActivity,
      completedExercises: new Set(
        completedExerciseActivities
          .map((activity) => activity.ExerciseID)
          .filter((exerciseId) => exerciseId !== null)
      ).size,
      notificationCount: unreadNotifications || 0,
      availableCourses: availableEnrollments.map((enrollment) => ({
        id: enrollment.CourseID,
        title: enrollment.Courses.Title
      })),
      currentCourse,
      learningPath,
      learningPathTitle,
      learningPathSource,
      learningPathStatus: learningPath.length ? 'ready' : 'not_created',
      aiInsight: buildDashboardInsight({
        currentCourse,
        knowledgeMap,
        avgScore: Number(averageScore.toFixed(2)),
        hasScoreData,
        totalStudySeconds
      }),
      knowledgeMap
    };

    return res.status(200).json({ success: true, data: dashboardData });
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
    const requestedCourseId = Number.parseInt(req.query.courseId, 10);
    if (req.query.courseId && (!Number.isInteger(requestedCourseId) || requestedCourseId <= 0)) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const activeEnrollments = await prisma.enrollments.findMany({
      where: {
        UserID: studentId,
        Status: 'Active',
        Courses: { Status: 'Published' }
      },
      orderBy: { EnrolledAt: 'asc' },
      select: {
        CourseID: true,
        Courses: {
          select: {
            CourseID: true,
            Title: true,
            Categories: { select: { CategoryName: true } }
          }
        }
      }
    });
    const availableCourses = activeEnrollments.map(enrollment => ({
      id: enrollment.Courses.CourseID,
      title: enrollment.Courses.Title,
      category: enrollment.Courses.Categories?.CategoryName || 'Chưa phân loại'
    }));
    const selectedCourseId = requestedCourseId || activeEnrollments[0]?.CourseID;

    if (!selectedCourseId || !activeEnrollments.some(enrollment => enrollment.CourseID === selectedCourseId)) {
      return res.status(200).json({ success: true, data: null, availableCourses });
    }

    const activeEnrollment = await prisma.enrollments.findFirst({
      where: {
        UserID: studentId,
        CourseID: selectedCourseId,
        Status: 'Active',
        Courses: { Status: 'Published' }
      },
      include: {
        Courses: {
          include: {
            Users: { select: { FullName: true, Email: true } },
            Categories: { select: { CategoryName: true } },
            Chapters: {
              orderBy: { OrderIndex: 'asc' },
              include: {
                Lessons: {
                  where: { Status: 'Published' },
                  orderBy: { OrderIndex: 'asc' },
                  select: { LessonID: true, Title: true, DurationMinutes: true }
                }
              }
            }
          }
        }
      }
    });
    if (!activeEnrollment?.Courses) {
      return res.status(200).json({ success: true, data: null, availableCourses });
    }

    const course = activeEnrollment.Courses;
    const allLessons = course.Chapters.flatMap(chapter => chapter.Lessons);
    const completedActivities = allLessons.length
      ? await prisma.learningActivities.findMany({
          where: {
            UserID: studentId,
            CourseID: course.CourseID,
            IsCompleted: true,
            ActionType: 'LessonCompleted',
            LessonID: { in: allLessons.map(lesson => lesson.LessonID) }
          },
          select: { LessonID: true }
        })
      : [];
    const completedLessonIds = new Set(completedActivities.map(activity => activity.LessonID));
    const firstIncompleteId = allLessons.find(lesson => !completedLessonIds.has(lesson.LessonID))?.LessonID;
    const completedCount = completedLessonIds.size;
    const totalLessons = allLessons.length;
    const progressPercent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

    const chaptersFormatted = course.Chapters.map(chapter => {
      const lessons = chapter.Lessons.map(lesson => ({
        id: lesson.LessonID,
        title: lesson.Title,
        duration: lesson.DurationMinutes ? `${lesson.DurationMinutes} phút` : 'Chưa đặt thời lượng',
        status: completedLessonIds.has(lesson.LessonID)
          ? 'completed'
          : lesson.LessonID === firstIncompleteId ? 'in-progress' : 'not-started'
      }));
      const chapterCompletedCount = lessons.filter(lesson => lesson.status === 'completed').length;
      return {
        id: chapter.ChapterID,
        title: chapter.Title,
        completedLessons: chapterCompletedCount,
        totalLessons: lessons.length,
        status: lessons.length > 0 && chapterCompletedCount === lessons.length
          ? 'completed'
          : lessons.some(lesson => lesson.status === 'in-progress') ? 'in-progress' : 'not-started',
        lessons
      };
    });

    const nextLesson = allLessons.find(lesson => lesson.LessonID === firstIncompleteId);
    const courseData = {
      id: course.CourseID,
      title: course.Title,
      category: course.Categories?.CategoryName || 'Chưa phân loại',
      description: course.Description || "Mô tả khóa học đang được cập nhật...",
      instructorName: course.Users?.FullName || course.Users?.Email || "Chưa cập nhật",
      instructorAvatar: (course.Users?.FullName || course.Users?.Email || "GV").substring(0, 2).toUpperCase(),
      totalLessons: totalLessons,
      totalExercises: 0,
      totalQuizzes: 0,
      totalHours: String(Math.max(1, Math.ceil(allLessons.reduce((total, lesson) => total + (lesson.DurationMinutes || 0), 0) / 60))),
      availableCourses,
      progressPercent,
      completedCount,
      inProgressCount: firstIncompleteId ? 1 : 0,
      remainingCount: Math.max(0, totalLessons - completedCount - (firstIncompleteId ? 1 : 0)),
      nextLesson: nextLesson ? {
        id: nextLesson.LessonID,
        chapterName: course.Chapters.find(chapter => chapter.Lessons.some(lesson => lesson.LessonID === nextLesson.LessonID))?.Title || '',
        lessonName: nextLesson.Title,
        duration: nextLesson.DurationMinutes ? `${nextLesson.DurationMinutes} phút` : 'Chưa đặt thời lượng'
      } : null,
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
    const [topicProgress, learningStats, activities] = await Promise.all([
      prisma.studentTopicProgress.findMany({
        where: { UserID: userId },
        include: {
          KnowledgeTopics: {
            select: { TopicName: true }
          }
        },
        orderBy: { LastUpdated: 'desc' }
      }),
      prisma.studentLearningStats.findMany({
        where: { UserID: userId },
        select: { TotalTimeSpentSeconds: true, AverageScore: true }
      }),
      prisma.learningActivities.findMany({
        where: {
          UserID: userId,
          CreatedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        },
        orderBy: { CreatedAt: 'desc' },
        take: 5000,
        select: { CreatedAt: true, TimeSpentSeconds: true, Score: true }
      })
    ]);

    const average = (values) => values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    const toDateKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const overallMastery = average(topicProgress.map((item) => Number(item.MasteryLevel) || 0));
    const recordedScores = activities
      .filter((activity) => activity.Score !== null)
      .map((activity) => Number(activity.Score) || 0);
    const statsAverageScore = average(learningStats.map((item) => Number(item.AverageScore) || 0));
    const avgScore = statsAverageScore || average(recordedScores);
    const statsStudySeconds = learningStats.reduce(
      (sum, item) => sum + (Number(item.TotalTimeSpentSeconds) || 0),
      0
    );
    const totalStudySeconds = statsStudySeconds || activities.reduce(
      (sum, activity) => sum + (Number(activity.TimeSpentSeconds) || 0),
      0
    );
    const studyDays = new Set(activities.map((activity) => toDateKey(activity.CreatedAt)));
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = toDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);
    let streak = 0;
    const streakStart = studyDays.has(todayKey)
      ? today
      : studyDays.has(yesterdayKey)
        ? yesterday
        : null;

    if (streakStart) {
      const cursor = new Date(streakStart);
      while (studyDays.has(toDateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const activeStudyDays = [...studyDays].filter((dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const activityDate = new Date(year, month - 1, day);
      return activityDate >= thirtyDaysAgo && activityDate <= today;
    }).length;
    const studyConsistency = Math.round((activeStudyDays / 30) * 100);

    const knowledgeMastery = topicProgress.map((item) => {
      const score = Math.min(Math.max(Number(item.MasteryLevel) || 0, 0), 100);
      const status = score >= 80
        ? 'Thành thạo'
        : score >= 50
          ? 'Đang tiến bộ'
          : 'Cần luyện tập';

      return {
        name: item.KnowledgeTopics.TopicName,
        score: Number(score.toFixed(2)),
        status,
        trend: 'Mức hiện tại'
      };
    });
    const strengths = knowledgeMastery
      .filter((item) => item.score >= 80)
      .map(({ name, score }) => ({ name, score }));
    const weaknesses = knowledgeMastery
      .filter((item) => item.score < 60)
      .map((item) => ({
        name: item.name,
        suggestion: item.score === 0
          ? 'Hãy bắt đầu học các bài thuộc chủ đề này để hệ thống ghi nhận tiến độ.'
          : 'Nên ôn lại bài học và làm thêm bài tập thuộc chủ đề này.'
      }));
    const studyHours = totalStudySeconds / 3600;
    const totalStudyTime = studyHours >= 1
      ? `${Number(studyHours.toFixed(1))} giờ`
      : `${Math.round(totalStudySeconds / 60)} phút`;

    const profileData = {
      overallMastery: Number(overallMastery.toFixed(2)),
      masteryLevel: overallMastery >= 80
        ? 'Thành thạo'
        : overallMastery >= 50
          ? 'Đang tiến bộ'
          : topicProgress.length > 0
            ? 'Cần luyện tập'
            : 'Chưa có dữ liệu',
      avgScore: Number(avgScore.toFixed(2)),
      avgScoreStatus: learningStats.length || recordedScores.length
        ? 'Điểm trung bình từ dữ liệu đã ghi nhận'
        : 'Chưa có điểm được ghi nhận',
      studyConsistency,
      consistencyFreq: `${activeStudyDays}/30 ngày có hoạt động`,
      totalStudyTime,
      studyTimePeriod: totalStudySeconds > 0 ? 'Tổng thời gian đã ghi nhận' : 'Chưa có thời gian được ghi nhận',
      streak,
      streakStatus: streak > 0 ? 'Ngày học liên tiếp hiện tại' : 'Chưa có chuỗi ngày học liên tiếp',
      knowledgeMastery,
      strengths,
      weaknesses
    };

    return res.status(200).json({ success: true, data: profileData });
  } catch (error) {
    console.error('Lỗi lấy data Profile:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải hồ sơ năng lực học tập.' });
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
          select: {
            CourseID: true,
            Title: true,
            Courses: { select: { Status: true } }
          }
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
    if (lesson.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Bài học này chưa được giảng viên xuất bản.' });
    }
    const courseId = lesson.Chapters?.CourseID;
    if (lesson.Chapters?.Courses?.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Khóa học này hiện không khả dụng.' });
    }
    const enrollment = await prisma.enrollments.findUnique({
      where: { UserID_CourseID: { UserID: req.user.userId, CourseID: courseId } },
      select: { Status: true }
    });
    if (enrollment?.Status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Bạn cần có ghi danh đã được duyệt để xem bài học.' });
    }

    const data = {
      id: lesson.LessonID,
      courseId,
      title: lesson.Title,
      chapter: lesson.Chapters?.Title || "Chưa có chương",
      duration: lesson.DurationMinutes,
      difficulty: lesson.Difficulty || "Beginner",
      hasVideo: lesson.HasVideo,
      videoUrl: lesson.VideoUrl,
      hasArticle: lesson.HasArticle,
      articleContent: lesson.ArticleContent,
      hasSlide: lesson.HasSlide,
      slideUrl: lesson.SlideUrl,
      slideOriginalUrl: getUploadedSlideAsset(lesson.SlideUrl)
        ? `/api/student/lesson/${lesson.LessonID}/slides/original?asset=${encodeURIComponent(getUploadedSlideAsset(lesson.SlideUrl))}`
        : null,
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

const getStudentLessonSlide = async (req, res) => {
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
        Status: true,
        HasSlide: true,
        SlideUrl: true,
        Chapters: {
          select: {
            CourseID: true,
            Courses: { select: { Status: true } }
          }
        }
      }
    });
    if (!lesson || lesson.Status !== 'Published' || lesson.Chapters.Courses.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Bài học không khả dụng.' });
    }
    const enrollment = await prisma.enrollments.findUnique({
      where: {
        UserID_CourseID: {
          UserID: req.user.userId,
          CourseID: lesson.Chapters.CourseID
        }
      },
      select: { Status: true }
    });
    if (enrollment?.Status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Bạn cần có ghi danh đã được duyệt để xem slide.' });
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
    console.error('Lỗi đọc slide học viên:', error);
    return res.status(500).json({ success: false, message: 'Không thể mở tệp slide.' });
  }
};

// ==============================================================
// CÁC API MỚI CHO TÍNH NĂNG KHÁM PHÁ & ĐĂNG KÝ
// ==============================================================

// GET: LẤY DỮ LIỆU KHÁM PHÁ (GIẢNG VIÊN & KHÓA HỌC)
const getExploreData = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const categoryId = req.query.categoryId ? Number.parseInt(req.query.categoryId, 10) : null;
    const instructorId = req.query.instructorId ? Number.parseInt(req.query.instructorId, 10) : null;
    if (
      (req.query.categoryId && (!Number.isInteger(categoryId) || categoryId <= 0)) ||
      (req.query.instructorId && (!Number.isInteger(instructorId) || instructorId <= 0))
    ) {
      return res.status(400).json({ success: false, message: 'Bộ lọc khóa học không hợp lệ.' });
    }

    const courseWhere = {
      Status: 'Published',
      ...(categoryId ? { CategoryID: categoryId } : {}),
      ...(instructorId ? { InstructorID: instructorId } : {}),
      ...(search ? {
        OR: [
          { Title: { contains: search } },
          { Description: { contains: search } },
          { Users: { FullName: { contains: search } } },
          { Categories: { CategoryName: { contains: search } } },
          { KnowledgeTopics: { some: { TopicName: { contains: search } } } }
        ]
      } : {})
    };

    const instructors = await prisma.users.findMany({
      where: {
        Roles: { RoleName: { in: ['Teacher', 'Giảng viên', 'Instructor'] } },
        Courses: { some: { Status: 'Published' } }
      },
      select: {
        UserID: true,
        Email: true,
        FullName: true,
        _count: { select: { Courses: { where: { Status: 'Published' } } } }
      }
    });

    const [courses, categories] = await Promise.all([
      prisma.courses.findMany({
        where: courseWhere,
        orderBy: { CreatedAt: 'desc' },
        include: {
          Users: { select: { FullName: true, Email: true } },
          Categories: { select: { CategoryID: true, CategoryName: true } },
          _count: { select: { Chapters: true } }
        }
      }),
      prisma.categories.findMany({
        where: { Courses: { some: { Status: 'Published' } } },
        orderBy: { CategoryName: 'asc' },
        select: { CategoryID: true, CategoryName: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        instructors: instructors.map(inst => ({
          id: inst.UserID,
          name: inst.FullName || inst.Email,
          courseCount: inst._count.Courses,
          title: 'Giảng viên',
          description: ''
        })),
        courses: courses.map(course => ({
          id: course.CourseID,
          title: course.Title,
          description: course.Description,
          instructor: course.Users?.FullName || course.Users?.Email || 'Chưa cập nhật',
          instructorId: course.InstructorID,
          category: course.Categories?.CategoryName || 'Chưa phân loại',
          categoryId: course.Categories?.CategoryID,
          chapterCount: course._count.Chapters
        })),
        categories
      }
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu Explore:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getExploreCourseDetail = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, Status: 'Published' },
      include: {
        Users: { select: { FullName: true, Email: true } },
        Categories: { select: { CategoryName: true } },
        Chapters: {
          orderBy: { OrderIndex: 'asc' },
          include: {
            Lessons: {
              where: { Status: 'Published' },
              orderBy: { OrderIndex: 'asc' },
              select: { LessonID: true, Title: true, DurationMinutes: true }
            }
          }
        }
      }
    });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học đang mở.' });
    return res.json({
      success: true,
      data: {
        id: course.CourseID,
        title: course.Title,
        description: course.Description || '',
        instructor: course.Users?.FullName || course.Users?.Email || 'Chưa cập nhật',
        category: course.Categories?.CategoryName || 'Chưa phân loại',
        chapters: course.Chapters.map(chapter => ({
          id: chapter.ChapterID,
          title: chapter.Title,
          lessons: chapter.Lessons.map(lesson => ({
            id: lesson.LessonID,
            courseId,
            title: lesson.Title,
            durationMinutes: lesson.DurationMinutes
          }))
        }))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết khóa học Explore:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getExploreEnrollmentStatus = async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }
    const course = await prisma.courses.findFirst({
      where: { CourseID: courseId, Status: 'Published' },
      select: { CourseID: true }
    });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học đang mở.' });
    const enrollment = await prisma.enrollments.findUnique({
      where: { UserID_CourseID: { UserID: req.user.userId, CourseID: courseId } },
      select: { Status: true }
    });
    return res.json({ success: true, data: { status: enrollment?.Status || null } });
  } catch (error) {
    console.error('Lỗi kiểm tra ghi danh khóa học:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra trạng thái ghi danh.' });
  }
};

const getEnrolledLesson = async (lessonId, userId) => {
  const lesson = await prisma.lessons.findUnique({
    where: { LessonID: lessonId },
    select: {
      LessonID: true,
      ChapterID: true,
      Status: true,
      Chapters: {
        select: {
          CourseID: true,
          Courses: { select: { Status: true } }
        }
      }
    }
  });
  if (!lesson || lesson.Status !== 'Published' || lesson.Chapters?.Courses?.Status !== 'Published') return null;

  const enrollment = await prisma.enrollments.findUnique({
    where: {
      UserID_CourseID: {
        UserID: userId,
        CourseID: lesson.Chapters.CourseID
      }
    },
    select: { Status: true }
  });
  return enrollment?.Status === 'Active' ? lesson : null;
};

const recordLessonTime = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    const seconds = req.body?.seconds;
    if (!Number.isInteger(lessonId) || lessonId <= 0 || !Number.isInteger(seconds) || seconds < 1 || seconds > 300) {
      return res.status(400).json({ success: false, message: 'Dữ liệu thời gian học không hợp lệ.' });
    }

    const lesson = await getEnrolledLesson(lessonId, req.user.userId);
    if (!lesson) return res.status(403).json({ success: false, message: 'Bạn không có quyền ghi nhận tiến độ bài học này.' });

    const courseId = lesson.Chapters.CourseID;
    await prisma.$transaction(async (tx) => {
      await tx.learningActivities.create({
        data: {
          UserID: req.user.userId,
          CourseID: courseId,
          LessonID: lessonId,
          ActionType: 'LessonProgress',
          TimeSpentSeconds: seconds,
          IsCompleted: false
        }
      });
      await tx.studentLearningStats.upsert({
        where: { UserID_CourseID: { UserID: req.user.userId, CourseID: courseId } },
        create: {
          UserID: req.user.userId,
          CourseID: courseId,
          TotalTimeSpentSeconds: seconds,
          LastActive: new Date()
        },
        update: {
          TotalTimeSpentSeconds: { increment: seconds },
          LastActive: new Date()
        }
      });
    });

    return res.json({ success: true, message: 'Đã lưu thời gian học.' });
  } catch (error) {
    console.error('Lỗi ghi nhận thời gian học:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu thời gian học lúc này.' });
  }
};

const completeLesson = async (req, res) => {
  try {
    const lessonId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return res.status(400).json({ success: false, message: 'ID bài học không hợp lệ.' });
    }

    const lesson = await getEnrolledLesson(lessonId, req.user.userId);
    if (!lesson) return res.status(403).json({ success: false, message: 'Bạn không có quyền hoàn thành bài học này.' });

    const courseId = lesson.Chapters.CourseID;
    const progress = await prisma.$transaction(async (tx) => {
      await tx.learningActivities.create({
        data: {
          UserID: req.user.userId,
          CourseID: courseId,
          LessonID: lessonId,
          ActionType: 'LessonCompleted',
          IsCompleted: true
        }
      });
      await tx.learningPathItems.updateMany({
        where: {
          TargetLessonID: lessonId,
          LearningPaths: {
            is: { UserID: req.user.userId, CourseID: courseId, Status: 'Active' }
          }
        },
        data: { IsCompleted: true }
      });
      const [courseLessons, completedActivities] = await Promise.all([
        tx.lessons.findMany({
          where: { Chapters: { CourseID: courseId }, Status: 'Published' },
          select: { LessonID: true }
        }),
        tx.learningActivities.findMany({
          where: {
            UserID: req.user.userId,
            CourseID: courseId,
            IsCompleted: true,
            ActionType: 'LessonCompleted',
            LessonID: { not: null }
          },
          select: { LessonID: true }
        })
      ]);
      const lessonIds = new Set(courseLessons.map(item => item.LessonID));
      const completedLessonIds = new Set(
        completedActivities
          .map(activity => activity.LessonID)
          .filter(id => id !== null && lessonIds.has(id))
      );
      const progressPercent = lessonIds.size
        ? Number(((completedLessonIds.size / lessonIds.size) * 100).toFixed(2))
        : 0;
      await tx.enrollments.update({
        where: { UserID_CourseID: { UserID: req.user.userId, CourseID: courseId } },
        data: { ProgressPercent: progressPercent }
      });
      return {
        progressPercent,
        completedCount: completedLessonIds.size,
        totalLessons: lessonIds.size
      };
    });

    return res.json({
      success: true,
      message: 'Đã đánh dấu bài học hoàn thành.',
      data: progress
    });
  } catch (error) {
    console.error('Lỗi hoàn thành bài học:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật tiến độ bài học lúc này.' });
  }
};

// POST: SINH VIÊN GỬI YÊU CẦU ĐĂNG KÝ KHÓA HỌC
const enrollCourse = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const courseId = req.body?.courseId;
    const parsedCourseId = Number.parseInt(courseId, 10);
    if (!Number.isInteger(parsedCourseId) || parsedCourseId <= 0) {
      return res.status(400).json({ success: false, message: 'ID khóa học không hợp lệ.' });
    }

    const course = await prisma.courses.findUnique({
      where: { CourseID: parsedCourseId },
      select: { Status: true }
    });
    if (!course || course.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Khóa học không tồn tại hoặc hiện không khả dụng.' });
    }

    const existingEnrollment = await prisma.enrollments.findFirst({
      where: { UserID: studentId, CourseID: parsedCourseId }
    });

    if (existingEnrollment) {
      return res.status(200).json({
        success: true,
        data: { status: existingEnrollment.Status },
        message: existingEnrollment.Status === 'Pending'
          ? 'Bạn đã gửi yêu cầu và đang chờ giảng viên duyệt.'
          : existingEnrollment.Status === 'Active'
            ? 'Bạn đã được ghi danh vào khóa học này.'
            : 'Bạn đã có yêu cầu đăng ký khóa học này.'
      });
    }

    await prisma.enrollments.create({
      data: {
        UserID: studentId,
        CourseID: parsedCourseId,
        Status: 'Pending',
        ProgressPercent: 0
      }
    });

    res.status(201).json({
      success: true,
      data: { status: 'Pending' },
      message: 'Gửi yêu cầu đăng ký thành công! Vui lòng chờ giảng viên duyệt.'
    });
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
        KnowledgeTopics: {
          select: {
            TopicName: true,
            CourseID: true,
            Courses: { select: { Status: true } }
          }
        },
        Lessons: {
          select: {
            Status: true,
            Chapters: {
              select: {
                CourseID: true,
                Courses: { select: { Status: true } }
              }
            }
          }
        }
      }
    });

    if (!exercise) return res.status(404).json({ success: false, message: 'Bài tập không tồn tại' });
    if (exercise.Lessons && exercise.Lessons.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Bài học này chưa được giảng viên xuất bản.' });
    }
    const courseId = exercise.Lessons?.Chapters?.CourseID || exercise.KnowledgeTopics?.CourseID;
    const courseStatus = exercise.Lessons?.Chapters?.Courses?.Status || exercise.KnowledgeTopics?.Courses?.Status;
    if (courseId && courseStatus !== 'Published') {
      return res.status(404).json({ success: false, message: 'Khóa học này hiện không khả dụng.' });
    }
    if (courseId) {
      const enrollment = await prisma.enrollments.findUnique({
        where: { UserID_CourseID: { UserID: req.user.userId, CourseID: courseId } },
        select: { Status: true }
      });
      if (enrollment?.Status !== 'Active') {
        return res.status(403).json({ success: false, message: 'Bạn cần có ghi danh đã được duyệt để xem bài tập.' });
      }
    }

    // Parse TestCases JSON từ SQL Server (Giả định Giảng viên lưu dạng [{input: "...", expected: "..."}])
    let testCases = [];
    if (exercise.TestCases) {
      try { testCases = JSON.parse(exercise.TestCases); } catch (e) { console.error("Lỗi parse TestCases"); }
    }

    const data = {
      id: exercise.ExerciseID,
      courseId: exercise.Lessons?.Chapters?.CourseID || exercise.KnowledgeTopics?.CourseID || null,
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
        Type: 'Practice',
        OR: [
          {
            Lessons: {
              Status: 'Published',
              Chapters: {
                Courses: {
                  Status: 'Published',
                  Enrollments: { some: { UserID: req.user.userId, Status: 'Active' } }
                }
              }
            }
          },
          {
            Lessons: null,
            KnowledgeTopics: {
              Courses: {
                Status: 'Published',
                Enrollments: { some: { UserID: req.user.userId, Status: 'Active' } }
              }
            }
          },
          { Lessons: null, KnowledgeTopics: null }
        ]
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
      where: {
        UserID: studentId,
        Status: 'Active',
        Courses: { Status: 'Published' }
      },
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
        Lessons: {
          Status: 'Published',
          Chapters: {
            CourseID: { in: courseIds },
            Courses: { Status: 'Published' }
          }
        }
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
      where: {
        UserID: studentId,
        Status: 'Active',
        Courses: { Status: 'Published' }
      },
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
        Lessons: {
          Status: 'Published',
          Chapters: {
            CourseID: { in: courseIds },
            Courses: { Status: 'Published' }
          }
        }
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
      where: {
        UserID: studentId,
        Status: 'Active',
        Courses: { Status: 'Published' }
      },
      select: { CourseID: true }
    });
    const courseIds = enrollments.map((enrollment) => enrollment.CourseID);

    const quiz = courseIds.length
      ? await prisma.exercises.findFirst({
          where: {
            ExerciseID: quizId,
            Type: 'Quiz',
            Status: 'Published',
            Lessons: {
              Status: 'Published',
              Chapters: {
                CourseID: { in: courseIds },
                Courses: { Status: 'Published' }
              }
            }
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

      const scoredAnswers = gradedAnswers.filter((item) => item.question.type !== 'essay');
      const scoredPoints = scoredAnswers.reduce(
        (sum, item) => sum + Number(item.question.points),
        0
      );
      if (scoredAnswers.length > 0 && scoredPoints > 0) {
        const correctPoints = scoredAnswers.reduce(
          (sum, item) => sum + (item.isCorrect ? Number(item.question.points) : 0),
          0
        );
        const correctCount = scoredAnswers.filter((item) => item.isCorrect).length;
        await updateTopicProgress(tx, {
          userId: studentId,
          topicId,
          attempted: scoredAnswers.length,
          correct: correctCount,
          averageScore: (correctPoints / scoredPoints) * 100,
          attemptedAt: submittedAt
        });
      }

      await tx.learningPathItems.updateMany({
        where: {
          TargetExerciseID: quiz.ExerciseID,
          LearningPaths: {
            is: { UserID: studentId, CourseID: courseId, Status: 'Active' }
          }
        },
        data: { IsCompleted: true }
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
          select: { Title: true, Type: true, MaxScore: true }
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

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả bài kiểm tra' });
    }
    if (
      attempt.Exercises.Type === 'Quiz' &&
      ['Pending', 'Draft'].includes(attempt.GradingStatus) &&
      attempt.Submissions.some((submission) => submission.TestQuestions.QuestionType === 'essay')
    ) {
      return res.status(409).json({ success: false, message: 'Kết quả đang chờ giảng viên chấm và công bố' });
    }

    if (attempt.Exercises.Type !== 'Quiz') {
      return res.status(200).json({
        success: true,
        data: {
          attemptId: attempt.AttemptID,
          type: 'Practice',
          title: attempt.Exercises.Title,
          totalScore: Number(attempt.TotalScore),
          maxScore: Number(attempt.Exercises.MaxScore) || 10,
          instructorFeedback: attempt.InstructorFeedback || '',
          submissions: attempt.Submissions.map((submission) => ({
            question: submission.TestQuestions.Content,
            codeSubmitted: submission.CodeSubmitted,
            isCorrect: submission.IsCorrect,
            scoreEarned: Number(submission.ScoreEarned),
            points: Number(submission.TestQuestions.Points)
          }))
        }
      });
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
        type: 'Quiz',
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
    const studentId = req.user?.userId;

    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Lỗi xác thực: Không tìm thấy ID học viên.' });
    }

    const { exerciseId, courseId, code, isPassed } = req.body;

    if (
      !Number.isSafeInteger(Number(exerciseId)) ||
      Number(exerciseId) <= 0 ||
      !Number.isSafeInteger(Number(courseId)) ||
      Number(courseId) <= 0 ||
      typeof code !== 'string' ||
      !code.trim() ||
      typeof isPassed !== 'boolean'
    ) {
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
        KnowledgeTopics: {
          select: {
            CourseID: true,
            Courses: { select: { Status: true } }
          }
        },
        Lessons: {
          select: {
            Status: true,
            Title: true,
            Chapters: {
              select: {
                Title: true,
                CourseID: true,
                Courses: { select: { Status: true } }
              }
            }
          }
        }
      }
    });

    if (!exercise) return res.status(404).json({ success: false, message: 'Bài tập không tồn tại.' });
    if (exercise.Lessons && exercise.Lessons.Status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Bài học này chưa được giảng viên xuất bản.' });
    }
    const exerciseCourseId = exercise.Lessons?.Chapters?.CourseID || exercise.KnowledgeTopics?.CourseID;
    const courseStatus = exercise.Lessons?.Chapters?.Courses?.Status || exercise.KnowledgeTopics?.Courses?.Status;
    if (exerciseCourseId && courseStatus !== 'Published') {
      return res.status(409).json({ success: false, message: 'Khóa học này hiện không khả dụng, không thể nộp bài.' });
    }
    if (
      exerciseCourseId !== cIdInt ||
      (exercise.TopicID && exercise.KnowledgeTopics?.CourseID !== cIdInt)
    ) {
      return res.status(400).json({ success: false, message: 'Khóa học không khớp với bài tập.' });
    }

    const activeEnrollment = await prisma.enrollments.findFirst({
      where: { UserID: studentId, CourseID: cIdInt, Status: 'Active' },
      select: { EnrollmentID: true }
    });
    if (!activeEnrollment) {
      return res.status(403).json({ success: false, message: 'Bạn cần có ghi danh đang hoạt động trong khóa học để nộp bài.' });
    }
    
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
      const submittedAt = new Date();
      
      // BƯỚC 1: Tạo TestAttempt
      const attempt = await prisma.testAttempts.create({
        data: {
          UserID: studentId,
          ExerciseID: exIdInt,
          StartTime: submittedAt,
          EndTime: submittedAt,
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
          CreatedAt: submittedAt
        }
      });

      await updateTopicProgress(prisma, {
        userId: studentId,
        topicId: validTopicId,
        attempted: 1,
        correct: isPassed ? 1 : 0,
        averageScore: isPassed ? 100 : 0,
        attemptedAt: submittedAt
      });

      if (isPassed) {
        await prisma.learningPathItems.updateMany({
          where: {
            TargetExerciseID: exIdInt,
            LearningPaths: {
              is: { UserID: studentId, CourseID: cIdInt, Status: 'Active' }
            }
          },
          data: { IsCompleted: true }
        });
      }

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
  getStudentLessonSlide,
  getExploreData,
  getExploreCourseDetail,
  getExploreEnrollmentStatus,
  recordLessonTime,
  completeLesson,
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