const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { callLLMProvider } = require('../../services/aiService');

// =========================================================
// HÀM DỰ PHÒNG (RULE-BASED FALLBACK) KHI MODEL AI KÉM HIỆU QUẢ
// =========================================================
const buildFallbackItems = (weakTopics, validLessons, validExercises) => {
  const fallbackList = [];
  let order = 1;

  const targetTopicIds = weakTopics.map(t => t.topicId);
  const prioritizedLessons = [
    ...validLessons.filter(lesson => lesson.topicIds.some(id => targetTopicIds.includes(id))),
    ...validLessons.filter(lesson => !lesson.topicIds.some(id => targetTopicIds.includes(id)))
  ];

  for (const lesson of prioritizedLessons) {
    if (order > 5) break;
    const matchTopic = lesson.topicIds.find(id => targetTopicIds.includes(id));
    fallbackList.push({
      TargetTopicID: matchTopic || null,
      TargetLessonID: lesson.id,
      TargetExerciseID: null,
      RecommendationReason: `Ôn tập lại lý thuyết bài "${lesson.title}" để nắm vững nền tảng.`,
      OrderIndex: order++
    });
  }

  const sortedExercises = [...validExercises].sort((a, b) => {
    const aMatchesWeakTopic = targetTopicIds.includes(a.topicId);
    const bMatchesWeakTopic = targetTopicIds.includes(b.topicId);
    if (aMatchesWeakTopic !== bMatchesWeakTopic) return aMatchesWeakTopic ? -1 : 1;
    return a.level - b.level;
  });
  for (const ex of sortedExercises) {
    if (order > 6) break;
    fallbackList.push({
      TargetTopicID: ex.topicId || null,
      TargetLessonID: ex.lessonId || null,
      TargetExerciseID: ex.id,
      RecommendationReason: `Luyện tập thực hành "${ex.title}" (Mức độ ${ex.level}) để cải thiện điểm số.`,
      OrderIndex: order++
    });
  }

  return fallbackList;
};


// =========================================================
// API CHÍNH: SINH LỘ TRÌNH HỌC TẬP CÁ NHÂN HÓA (UC1.8)
// =========================================================
const generateLearningPath = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { courseId, provider } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Không xác định được tài khoản học viên.' });
    }

    const parsedCourseId = Number(courseId);
    if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId <= 0) {
      return res.status(400).json({ success: false, message: 'CourseID không hợp lệ.' });
    }

    const selectedProvider = String(provider || process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
    if (!['gemini', 'openai'].includes(selectedProvider)) {
      return res.status(400).json({ success: false, message: 'Nhà cung cấp AI không được hỗ trợ.' });
    }

    const activeEnrollment = await prisma.enrollments.findFirst({
      where: {
        UserID: userId,
        CourseID: parsedCourseId,
        Status: 'Active',
        Courses: { Status: { not: 'Archived' } }
      },
      select: { EnrollmentID: true }
    });

    if (!activeEnrollment) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần có ghi danh đang hoạt động trong khóa học để tạo lộ trình.'
      });
    }

    // 1. LẤY DỮ LIỆU TIẾN ĐỘ THEO TOPIC & HOẠT ĐỘNG GẦN ĐÂY
    const topicProgress = await prisma.studentTopicProgress.findMany({
      where: {
        UserID: userId,
        KnowledgeTopics: { CourseID: parsedCourseId }
      },
      include: { KnowledgeTopics: { select: { TopicID: true, TopicName: true } } }
    });

    const recentActivities = await prisma.learningActivities.findMany({
      where: { UserID: userId, CourseID: parsedCourseId },
      orderBy: { CreatedAt: 'desc' },
      take: 15,
      select: { LessonID: true, ExerciseID: true, ActionType: true, Score: true, IsCompleted: true }
    });

    // Phân loại Điểm mạnh / Điểm yếu từ bảng StudentTopicProgress
    const weakTopics = [];
    const strongTopics = [];

    topicProgress.forEach(tp => {
      const item = {
        topicId: tp.TopicID,
        topicName: tp.KnowledgeTopics.TopicName,
        avgScore: Number(tp.AverageScore),
        mastery: Number(tp.MasteryLevel)
      };
      if (item.avgScore < 70 || item.mastery < 60) {
        weakTopics.push(item);
      } else {
        strongTopics.push(item);
      }
    });

    // Tính OverallMastery trung bình
    const overallMastery = topicProgress.length > 0
      ? topicProgress.reduce((sum, tp) => sum + Number(tp.MasteryLevel), 0) / topicProgress.length
      : 0;

    // 2. LẤY KHO NỘI DUNG HỢP LỆ CỦA KHÓA HỌC (DÙNG ĐỂ GỬI AI & ĐỐI CHIẾU VALIDATION)
    const courseLessons = await prisma.lessons.findMany({
      where: { Chapters: { CourseID: parsedCourseId } },
      select: {
        LessonID: true, Title: true, Difficulty: true,
        LessonTopics: { select: { TopicID: true } }
      }
    });

    const courseExercises = await prisma.exercises.findMany({
      where: {
        Status: { not: 'Draft' },
        OR: [
          { KnowledgeTopics: { CourseID: parsedCourseId } },
          { Lessons: { Chapters: { CourseID: parsedCourseId } } }
        ]
      },
      select: { ExerciseID: true, Title: true, DifficultyLevel: true, TopicID: true, LessonID: true }
    });

    if (courseLessons.length === 0 && courseExercises.length === 0) {
      return res.status(400).json({ success: false, message: 'Khóa học này chưa có bài học hoặc bài tập nào.' });
    }

    // Chuẩn hóa danh sách phẳng (Flat List) giúp các model AI yếu dễ đọc hơn cấu trúc lồng nhau
    const validLessons = courseLessons.map(l => ({
      id: l.LessonID,
      title: l.Title,
      difficulty: l.Difficulty,
      topicIds: l.LessonTopics.map(lt => lt.TopicID)
    }));

    const validExercises = courseExercises.map(e => ({
      id: e.ExerciseID,
      title: e.Title,
      level: e.DifficultyLevel,
      topicId: e.TopicID,
      lessonId: e.LessonID
    }));

    // Đưa vào Map để tra cứu O(1) ở bước Validation
    const lessonMap = new Map(validLessons.map(l => [l.id, l]));
    const exerciseMap = new Map(validExercises.map(e => [e.id, e]));

    const learningLevel = overallMastery >= 75
      ? 'Advanced'
      : overallMastery >= 45
        ? 'Intermediate'
        : 'Beginner';
    const learningSnapshot = {
      strengths: strongTopics,
      weaknesses: weakTopics,
      overallMastery: Number(overallMastery.toFixed(2)),
      learningLevel
    };
    const profileAndContext = await prisma.$transaction(async (tx) => {
      const profile = await tx.learningProfiles.create({
        data: {
          UserID: userId,
          CourseID: parsedCourseId,
          AnalyzedStrengths: JSON.stringify(strongTopics),
          AnalyzedWeaknesses: JSON.stringify(weakTopics),
          OverallMastery: learningSnapshot.overallMastery,
          LearningLevel: learningLevel
        }
      });

      const context = await tx.learningContexts.create({
        data: {
          ProfileID: profile.ProfileID,
          ActivityDataJSON: JSON.stringify(recentActivities),
          PerformanceDataJSON: JSON.stringify(learningSnapshot)
        }
      });

      return { profile, context };
    });

    // 3. XÂY DỰNG PROMPT TỐI GIẢN
    const promptText = `
Phân tích dữ liệu học viên và chọn từ 3 đến 6 bước học tiếp theo từ danh sách cho sẵn.

[HỒ SƠ HỌC TẬP]:
${JSON.stringify(learningSnapshot)}

[LEARNING CONTEXT]:
${JSON.stringify({
  recentActivities,
  topicProgress: topicProgress.map((tp) => ({
    topicId: tp.TopicID,
    topicName: tp.KnowledgeTopics.TopicName,
    attempted: tp.TotalQuestionsAttempted,
    correct: tp.CorrectAnswers,
    wrong: tp.WrongAnswers,
    averageScore: Number(tp.AverageScore),
    mastery: Number(tp.MasteryLevel)
  }))
})}

[CHỦ ĐỀ HỌC VIÊN ĐANG YẾU]:
${JSON.stringify(weakTopics)}

[HOẠT ĐỘNG HỌC TẬP GẦN ĐÂY]:
${JSON.stringify(recentActivities)}

[DANH SÁCH BÀI HỌC HỢP LỆ (LESSONS)]:
${JSON.stringify(validLessons)}

[DANH SÁCH BÀI TẬP HỢP LỆ (EXERCISES)]:
${JSON.stringify(validExercises)}

[QUY TẮC BẮT BUỘC]:
1. Chỉ được chọn "id" có thật trong [DANH SÁCH BÀI HỌC HỢP LỆ] hoặc [DANH SÁCH BÀI TẬP HỢP LỆ]. Tuyệt đối không tự bịa số ID.
2. Ưu tiên xếp bài học (Lesson) ôn lý thuyết trước, bài tập (Exercise) thực hành sau.
3. Dựa vào chủ đề yếu và hoạt động gần đây để cá nhân hóa; tránh đề xuất lặp lại nội dung đã hoàn thành nếu còn nội dung phù hợp khác.
4. Chỉ trả về đúng 1 JSON Object theo cấu trúc mẫu dưới đây, không giải thích thêm:
{
  "pathTitle": "Lộ trình cải thiện kỹ năng Python",
  "recommendedItems": [
    {
      "orderIndex": 1,
      "type": "Lesson",
      "targetId": 1,
      "topicId": 1,
      "reason": "Lý do cụ thể nên học bài này"
    }
  ]
}`;

    // 4. GỌI AI VÀ KIỂM DUYỆT KẾT QUẢ
    const aiResult = await callLLMProvider(promptText, { provider: selectedProvider });
    let validItemsToInsert = [];
    let pathTitle = 'Lộ trình học tập cá nhân hóa';
    let usedFallback = false;

    if (aiResult.success && Array.isArray(aiResult.parsedData?.recommendedItems)) {
      if (typeof aiResult.parsedData.pathTitle === 'string' && aiResult.parsedData.pathTitle.trim()) {
        pathTitle = aiResult.parsedData.pathTitle.trim().slice(0, 200);
      }
      const seenKeys = new Set(); // Chống lỗi AI gợi ý trùng lặp 1 bài nhiều lần
      let orderCounter = 1;

      for (const item of aiResult.parsedData.recommendedItems) {
        if (!item || typeof item !== 'object' || orderCounter > 6) continue;
        const type = String(item.type || '').trim();
        const targetId = Number(item.targetId);
        const key = `${type}_${targetId}`;

        if (!Number.isSafeInteger(targetId) || targetId <= 0 || seenKeys.has(key)) continue;

        // Đối chiếu Lesson có thuộc khóa học không
        if (type === 'Lesson' && lessonMap.has(targetId)) {
          const matchedLesson = lessonMap.get(targetId);
          seenKeys.add(key);
          validItemsToInsert.push({
            TargetTopicID: matchedLesson.topicIds[0] || null,
            TargetLessonID: matchedLesson.id,
            TargetExerciseID: null,
            RecommendationReason: typeof item.reason === 'string' && item.reason.trim()
              ? item.reason.trim()
              : `Ôn tập bài học: ${matchedLesson.title}`,
            OrderIndex: orderCounter++
          });
        }
        // Đối chiếu Exercise có thuộc khóa học không
        else if (type === 'Exercise' && exerciseMap.has(targetId)) {
          const matchedEx = exerciseMap.get(targetId);
          seenKeys.add(key);
          validItemsToInsert.push({
            TargetTopicID: matchedEx.topicId || null,
            TargetLessonID: matchedEx.lessonId || null,
            TargetExerciseID: matchedEx.id,
            RecommendationReason: typeof item.reason === 'string' && item.reason.trim()
              ? item.reason.trim()
              : `Thực hành bài tập: ${matchedEx.title}`,
            OrderIndex: orderCounter++
          });
        }
      }
    }

    // Dùng fallback khi AI lỗi, chỉ trả về ID không hợp lệ, hoặc không đủ bước tối thiểu.
    const minimumItemCount = Math.min(3, lessonMap.size + exerciseMap.size);
    if (validItemsToInsert.length < minimumItemCount) {
      usedFallback = true;
      validItemsToInsert = buildFallbackItems(weakTopics, validLessons, validExercises);
      pathTitle = 'Lộ trình củng cố kiến thức trọng tâm';
    }

    if (validItemsToInsert.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy nội dung phù hợp để tạo lộ trình cho khóa học này.'
      });
    }

    const generationStatus = usedFallback ? 'Fallback_Used' : 'Success';
    const persistenceResult = await prisma.$transaction(async (tx) => {
      const aiGenRecord = await tx.aIGenerations.create({
        data: {
          ContextID: profileAndContext.context.ContextID,
          Provider: aiResult.provider || selectedProvider,
          ModelName: aiResult.modelName,
          PromptText: promptText,
          RawAIResponse: aiResult.rawResponse,
          PromptTokens: aiResult.promptTokens,
          CompletionTokens: aiResult.completionTokens,
          ProcessingTimeMs: aiResult.processingTimeMs,
          Status: generationStatus,
          ErrorMessage: usedFallback
            ? aiResult.errorMessage || 'AI trả về ít bước hợp lệ; đã dùng thuật toán dự phòng.'
            : null
        }
      });

      await tx.learningPaths.updateMany({
        where: { UserID: userId, CourseID: parsedCourseId, Status: 'Active' },
        data: { Status: 'Archived' }
      });

      const newPath = await tx.learningPaths.create({
        data: {
          UserID: userId,
          CourseID: parsedCourseId,
          GenerationID: aiGenRecord.GenerationID,
          Title: pathTitle,
          Status: 'Active'
        }
      }); 

      const finalItems = validItemsToInsert.map(item => ({
        ...item,
        PathID: newPath.PathID,
        IsCompleted: false
      }));

      await tx.learningPathItems.createMany({ data: finalItems });

      return { path: newPath, itemsCount: finalItems.length };
    });

    return res.status(200).json({
      success: true,
      message: usedFallback
        ? 'Đã tạo lộ trình bằng thuật toán tiêu chuẩn (do AI đang bận).'
        : 'Đã tạo lộ trình AI cá nhân hóa thành công!',
      data: {
        pathId: persistenceResult.path.PathID,
        title: persistenceResult.path.Title,
        usedFallback,
        itemsCount: persistenceResult.itemsCount
      }
    });

  } catch (error) {
    console.error('Lỗi hệ thống khi sinh lộ trình:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý lộ trình học tập' });
  }
};

module.exports = { generateLearningPath };