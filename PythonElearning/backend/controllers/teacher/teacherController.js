const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. HÀM LẤY DỮ LIỆU DASHBOARD
const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Lấy thông tin khóa học đầu tiên do giảng viên này tạo
    const course = await prisma.courses.findFirst({
      where: { InstructorID: teacherId },
      include: {
        _count: {
          select: { Enrollments: true } // Đếm tổng số sinh viên
        }
      }
    });

    if (!course) {
      return res.status(200).json({ success: true, data: null });
    }

    // Đếm số đơn đăng ký đang chờ duyệt
    // const pendingApprovals = await prisma.enrollments.count({
    //   where: { 
    //     CourseID: course.CourseID,
    //     Status: 'Pending' 
    //   }
    // });

    // // Đếm số sinh viên đang Active
    // const activeStudents = await prisma.enrollments.count({
    //   where: { 
    //     CourseID: course.CourseID,
    //     Status: 'Active' 
    //   }
    // });
    // Không dùng cột Status nữa vì DB không có
    const pendingApprovals = 0; 

    // Đếm tổng số sinh viên trong khóa học (bỏ điều kiện Status)
    const activeStudents = await prisma.enrollments.count({
      where: { 
        CourseID: course.CourseID
      }
    });

    const data = {
      courseName: course.Title,
      totalStudentsClass: course._count.Enrollments,
      stats: {
        totalStudents: course._count.Enrollments,
        activeStudents: activeStudents,
        courseCompletion: 0,
        avgScore: 0,
      },
      pendingApprovals: pendingApprovals,
      gradeDistribution: [
        { range: '0-40', count: 0, height: '0%' },
        { range: '41-60', count: 0, height: '0%' },
        { range: '61-75', count: 0, height: '0%' },
        { range: '76-90', count: 0, height: '0%' },
        { range: '91-100', count: 0, height: '0%' },
      ],
      hardTopics: [],
      students: []
    };

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu Teacher Dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
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
    const course = await prisma.courses.findFirst({
      where: { InstructorID: teacherId },
      include: {
        Chapters: {
          include: {
            Lessons: {
              include: { Exercises: true } // Lấy kèm bài tập liên kết
            }
          }
        }
      }
    });

    if (!course) return res.status(200).json({ success: true, data: null });

    const formattedData = {
      id: course.CourseID, title: course.Title,
      stats: {
        lessons: course.Chapters.reduce((acc, ch) => acc + ch.Lessons.length, 0),
        exercises: 8, quizzes: 4
      },
      chapters: course.Chapters.map(ch => ({
        id: ch.ChapterID, title: ch.Title, progress: `${ch.Lessons.length} bài`,
        lessons: ch.Lessons.map(lesson => ({
          id: lesson.LessonID, title: lesson.Title, isDraft: false,
          content: lesson.ArticleContent || '',
          objectives: lesson.Objectives ? JSON.parse(lesson.Objectives) : [], // Parse JSON
          codeExample: lesson.CodeExample || '',
          exercises: lesson.Exercises.map(ex => ({ id: ex.ExerciseID, title: ex.Title }))
        }))
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

// POST: TẠO CHAPTER MỚI
const createChapter = async (req, res) => {
  try {
    const { courseId, title } = req.body;
    
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
    const { chapterId, title } = req.body;
    
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
    const { id } = req.params;
    const { title } = req.body;
    const updated = await prisma.chapters.update({
      where: { ChapterID: parseInt(id) },
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
    const { id } = req.params;
    await prisma.chapters.delete({ where: { ChapterID: parseInt(id) } });
    res.status(200).json({ success: true, message: 'Đã xóa chapter' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT: CẬP NHẬT BÀI HỌC (Đổi tên hoặc Đổi nội dung)
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, objectives, codeExample } = req.body;
    
    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.Title = title;
    if (content !== undefined) dataToUpdate.ArticleContent = content;
    if (objectives !== undefined) dataToUpdate.Objectives = JSON.stringify(objectives); // Lưu dạng JSON
    if (codeExample !== undefined) dataToUpdate.CodeExample = codeExample;

    const updated = await prisma.lessons.update({
      where: { LessonID: parseInt(id) },
      data: dataToUpdate
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// DELETE: XÓA BÀI HỌC
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.lessons.delete({ where: { LessonID: parseInt(id) } });
    res.status(200).json({ success: true, message: 'Đã xóa bài học' });
  } catch (error) {
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

    // Chuyển đổi chữ Easy/Medium/Hard thành số 1/2/3 cho SQL
    const diffLevel = difficulty === 'Hard' ? 3 : difficulty === 'Medium' ? 2 : 1;

    const newEx = await prisma.exercises.create({
      data: {
        LessonID: parseInt(lessonId), 
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
    const { id } = req.params;
    await prisma.exercises.delete({ where: { ExerciseID: parseInt(id) } });
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

// PUT: CẬP NHẬT CHI TIẾT BÀI TẬP
// PUT: CẬP NHẬT CHI TIẾT BÀI TẬP VÀ BÀI KIỂM TRA
const updateExerciseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. THÊM QuizConfig VÀO ĐÂY ĐỂ LẤY DỮ LIỆU TỪ FRONTEND GỬI LÊN
    const { title, difficulty, timeLimit, content, starterCode, hints, testCases, status, QuizConfig } = req.body;

    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.Title = title;
    if (difficulty !== undefined) dataToUpdate.DifficultyLevel = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3;
    if (timeLimit !== undefined) dataToUpdate.TimeLimitMinutes = parseInt(timeLimit);
    if (content !== undefined) dataToUpdate.Content = content;
    if (starterCode !== undefined) dataToUpdate.StarterCode = starterCode;
    if (status !== undefined) dataToUpdate.Status = status;
    if (hints !== undefined) dataToUpdate.Hints = JSON.stringify(hints);
    if (testCases !== undefined) dataToUpdate.TestCases = JSON.stringify(testCases);
    
    // 2. THÊM DÒNG NÀY ĐỂ ĐẨY QUIZCONFIG VÀO OBJECT CẬP NHẬT
    if (QuizConfig !== undefined) dataToUpdate.QuizConfig = QuizConfig;

    await prisma.exercises.update({
      where: { ExerciseID: parseInt(id) },
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

    const formattedQuizzes = quizzes.map(q => {
      const config = q.QuizConfig ? JSON.parse(q.QuizConfig) : {
        questionCount: 0, passScore: 70, 
        types: { multipleChoice: 0, trueFalse: 0, fillIn: 0 },
        tags: []
      };
      return {
        id: q.ExerciseID,
        title: q.Title,
        chapter: q.Lessons?.Chapters?.Title || 'Ch 1',
        timeLimit: q.TimeLimitMinutes,
        status: q.Status,
        config: config
      };
    });

    res.status(200).json({ success: true, data: formattedQuizzes });
  } catch (error) {
    console.error('Lỗi lấy danh sách Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST: TẠO BÀI KIỂM TRA MỚI
const createQuiz = async (req, res) => {
  try {
    const { lessonId, title } = req.body;
    if (!lessonId) return res.status(400).json({ success: false, message: 'Thiếu Chủ đề' });

    const newQuiz = await prisma.exercises.create({
      data: {
        LessonID: parseInt(lessonId),
        Title: title,
        Type: 'Quiz',
        TimeLimitMinutes: 15,
        DifficultyLevel: 2, // Mặc định Medium
        MaxScore: 100,
        Status: 'Draft',
        QuizConfig: JSON.stringify({
          questionCount: 0, passScore: 70, 
          types: { multipleChoice: 0, trueFalse: 0, fillIn: 0 },
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

module.exports = {
  getTeacherDashboard,
  getTeacherLayoutData,
  getTeacherCourseManagement,
  createCourse,
  createChapter,
  createLesson,
  updateChapter,
  deleteChapter,
  updateLesson,
  deleteLesson,
  createExercise,
  deleteExercise,
  getTeacherExercises,
  updateExerciseDetails,
  getTeacherQuizzes, 
  createQuiz
};