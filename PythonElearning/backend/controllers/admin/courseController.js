const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const courseStatuses = ['Draft', 'Pending', 'Published', 'Archived'];
const instructorRoleNames = ['instructor', 'teacher', 'giang vien'];

const normalizeText = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const handleError = (res, error, defaultMessage) => {
  if (error.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Tên danh mục hoặc khóa học đã tồn tại.' });
  }
  if (error.code === 'P2003') {
    return res.status(409).json({
      success: false,
      message: 'Không thể xóa vì dữ liệu đang được khóa học, bài học hoặc hoạt động học tập sử dụng.'
    });
  }
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(defaultMessage, error);
  return res.status(500).json({ success: false, message: defaultMessage });
};

const getManagementData = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all');
    const instructorId = req.query.instructorId ? parseId(req.query.instructorId) : null;

    if (status !== 'all' && !courseStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái khóa học không hợp lệ.' });
    }
    if (req.query.instructorId && !instructorId) {
      return res.status(400).json({ success: false, message: 'Giảng viên lọc không hợp lệ.' });
    }

    const where = {
      ...(status === 'all' ? {} : { Status: status }),
      ...(instructorId ? { InstructorID: instructorId } : {}),
      ...(search ? {
        OR: [
          { Title: { contains: search } },
          { Description: { contains: search } },
          { Users: { FullName: { contains: search } } },
          { Users: { Email: { contains: search } } },
          { Categories: { CategoryName: { contains: search } } }
        ]
      } : {})
    };

    const [
      courses,
      categories,
      instructorCandidates,
      totalCourses,
      statusCounts,
      activeEnrollments,
      completedEnrollments
    ] = await Promise.all([
      prisma.courses.findMany({
        where,
        include: {
          Categories: { select: { CategoryID: true, CategoryName: true } },
          Users: { select: { UserID: true, FullName: true, Email: true } },
          _count: { select: { Chapters: true, Enrollments: { where: { Status: 'Active' } } } }
        },
        orderBy: { CreatedAt: 'desc' }
      }),
      prisma.categories.findMany({
        orderBy: { CategoryName: 'asc' },
        include: { _count: { select: { Courses: true } } }
      }),
      prisma.users.findMany({
        where: { IsActive: true },
        select: { UserID: true, FullName: true, Email: true, Roles: { select: { RoleName: true } } },
        orderBy: { FullName: 'asc' }
      }),
      prisma.courses.count(),
      prisma.courses.groupBy({ by: ['Status'], _count: { _all: true } }),
      prisma.enrollments.count({ where: { Status: 'Active' } }),
      prisma.enrollments.groupBy({
        by: ['CourseID'],
        where: { ProgressPercent: { gte: 100 } },
        _count: { _all: true }
      })
    ]);

    const instructors = instructorCandidates
      .filter((user) => instructorRoleNames.includes(normalizeText(user.Roles.RoleName)))
      .map((user) => ({ id: user.UserID, fullName: user.FullName, email: user.Email }));
    const countsByStatus = Object.fromEntries(
      statusCounts.map((item) => [item.Status, item._count._all])
    );
    const completedByCourseId = new Map(
      completedEnrollments.map((item) => [item.CourseID, item._count._all])
    );

    return res.json({
      success: true,
      data: {
        courses: courses.map((course) => ({
          id: course.CourseID,
          title: course.Title,
          description: course.Description,
          status: course.Status,
          createdAt: course.CreatedAt,
          category: { id: course.Categories.CategoryID, name: course.Categories.CategoryName },
          instructor: {
            id: course.Users.UserID,
            fullName: course.Users.FullName,
            email: course.Users.Email
          },
          chapterCount: course._count.Chapters,
          studentCount: course._count.Enrollments,
          completedStudentCount: completedByCourseId.get(course.CourseID) || 0
        })),
        categories: categories.map((category) => ({
          id: category.CategoryID,
          name: category.CategoryName,
          description: category.Description,
          courseCount: category._count.Courses
        })),
        instructors,
        stats: {
          totalCourses,
          publishedCourses: countsByStatus.Published || 0,
          pendingCourses: countsByStatus.Pending || 0,
          activeEnrollments
        },
        statusCounts: Object.fromEntries(
          [['all', totalCourses], ...courseStatuses.map((value) => [value, countsByStatus[value] || 0])]
        )
      }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể tải dữ liệu khóa học và danh mục.');
  }
};

const createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc và tối đa 100 ký tự.' });
    }

    const duplicate = await prisma.categories.findMany({ select: { CategoryID: true, CategoryName: true } });
    if (duplicate.some((category) => normalizeText(category.CategoryName) === normalizeText(name))) {
      return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
    }

    const category = await prisma.categories.create({
      data: { CategoryName: name, Description: description || null }
    });
    return res.status(201).json({
      success: true,
      message: 'Đã thêm danh mục.',
      data: { id: category.CategoryID, name: category.CategoryName, description: category.Description }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể thêm danh mục.');
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = parseId(req.params.id);
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!categoryId) return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
    if (!name || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc và tối đa 100 ký tự.' });
    }

    const currentCategory = await prisma.categories.findUnique({ where: { CategoryID: categoryId } });
    if (!currentCategory) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });

    const duplicate = await prisma.categories.findMany({
      where: { CategoryID: { not: categoryId } },
      select: { CategoryName: true }
    });
    if (duplicate.some((category) => normalizeText(category.CategoryName) === normalizeText(name))) {
      return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
    }

    const category = await prisma.categories.update({
      where: { CategoryID: categoryId },
      data: { CategoryName: name, Description: description || null }
    });
    return res.json({
      success: true,
      message: 'Đã cập nhật danh mục.',
      data: { id: category.CategoryID, name: category.CategoryName, description: category.Description }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật danh mục.');
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = parseId(req.params.id);
    if (!categoryId) return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });

    const category = await prisma.categories.findUnique({
      where: { CategoryID: categoryId },
      include: { _count: { select: { Courses: true } } }
    });
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    if (category._count.Courses > 0) {
      return res.status(409).json({
        success: false,
        message: 'Danh mục đang chứa khóa học. Hãy chuyển các khóa học sang danh mục khác trước khi xóa.'
      });
    }

    await prisma.categories.delete({ where: { CategoryID: categoryId } });
    return res.json({ success: true, message: 'Đã xóa danh mục.' });
  } catch (error) {
    return handleError(res, error, 'Không thể xóa danh mục.');
  }
};

const createCourse = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const categoryId = parseId(req.body.categoryId);
    const instructorId = parseId(req.body.instructorId);
    if (!title || title.length > 200 || !categoryId || !instructorId) {
      return res.status(400).json({ success: false, message: 'Tên khóa học, danh mục và giảng viên là bắt buộc.' });
    }

    const [category, instructor, existingCourses] = await Promise.all([
      prisma.categories.findUnique({ where: { CategoryID: categoryId } }),
      prisma.users.findUnique({
        where: { UserID: instructorId },
        select: { UserID: true, IsActive: true, Roles: { select: { RoleName: true } } }
      }),
      prisma.courses.findMany({ select: { Title: true } })
    ]);
    if (!category) return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
    if (!instructor || !instructor.IsActive || !instructorRoleNames.includes(normalizeText(instructor.Roles.RoleName))) {
      return res.status(400).json({ success: false, message: 'Giảng viên không tồn tại hoặc không hoạt động.' });
    }
    if (existingCourses.some((course) => normalizeText(course.Title) === normalizeText(title))) {
      return res.status(409).json({ success: false, message: 'Tên khóa học đã tồn tại.' });
    }

    const course = await prisma.courses.create({
      data: {
        Title: title,
        Description: description || null,
        CategoryID: categoryId,
        InstructorID: instructorId,
        Status: 'Draft'
      }
    });
    return res.status(201).json({ success: true, message: 'Đã tạo khóa học ở trạng thái Draft.', data: { id: course.CourseID } });
  } catch (error) {
    return handleError(res, error, 'Không thể tạo khóa học.');
  }
};

const updateCourse = async (req, res) => {
  try {
    const courseId = parseId(req.params.id);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const categoryId = parseId(req.body.categoryId);
    const instructorId = parseId(req.body.instructorId);
    const status = String(req.body.status || '');
    if (!courseId) return res.status(400).json({ success: false, message: 'Mã khóa học không hợp lệ.' });
    if (!title || title.length > 200 || !categoryId || !instructorId || !courseStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Thông tin khóa học không hợp lệ.' });
    }

    const existingCourse = await prisma.courses.findUnique({ where: { CourseID: courseId } });
    if (!existingCourse) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học.' });

    const [category, instructor, existingCourses] = await Promise.all([
      prisma.categories.findUnique({ where: { CategoryID: categoryId } }),
      prisma.users.findUnique({
        where: { UserID: instructorId },
        select: { UserID: true, IsActive: true, Roles: { select: { RoleName: true } } }
      }),
      prisma.courses.findMany({
        where: { CourseID: { not: courseId } },
        select: { Title: true }
      })
    ]);
    if (!category) return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
    if (!instructor || !instructor.IsActive || !instructorRoleNames.includes(normalizeText(instructor.Roles.RoleName))) {
      return res.status(400).json({ success: false, message: 'Giảng viên không tồn tại hoặc không hoạt động.' });
    }
    if (existingCourses.some((course) => normalizeText(course.Title) === normalizeText(title))) {
      return res.status(409).json({ success: false, message: 'Tên khóa học đã tồn tại.' });
    }

    await prisma.courses.update({
      where: { CourseID: courseId },
      data: {
        Title: title,
        Description: description || null,
        CategoryID: categoryId,
        InstructorID: instructorId,
        Status: status
      }
    });
    return res.json({ success: true, message: 'Đã cập nhật khóa học.' });
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật khóa học.');
  }
};

const updateCourseLock = async (req, res) => {
  try {
    const courseId = parseId(req.params.id);
    const { isLocked } = req.body;
    if (!courseId || typeof isLocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Thông tin khóa/mở khóa không hợp lệ.' });
    }

    const course = await prisma.courses.findUnique({ where: { CourseID: courseId } });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học.' });
    if (isLocked === (course.Status === 'Archived')) {
      return res.status(409).json({
        success: false,
        message: isLocked ? 'Khóa học đã được khóa.' : 'Khóa học hiện không ở trạng thái đã khóa.'
      });
    }
    const nextStatus = isLocked ? 'Archived' : 'Draft';
    await prisma.courses.update({ where: { CourseID: courseId }, data: { Status: nextStatus } });
    return res.json({
      success: true,
      message: isLocked ? 'Đã khóa khóa học.' : 'Đã mở khóa khóa học và chuyển về Draft.',
      data: { id: course.CourseID, status: nextStatus }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể thay đổi trạng thái khóa học.');
  }
};

const updateCourseStatus = async (req, res) => {
  try {
    const courseId = parseId(req.params.id);
    const { status } = req.body;
    if (!courseId || !courseStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái khóa học không hợp lệ.' });
    }

    const course = await prisma.courses.findUnique({ where: { CourseID: courseId } });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học.' });
    await prisma.courses.update({ where: { CourseID: courseId }, data: { Status: status } });
    return res.json({ success: true, message: 'Đã cập nhật trạng thái khóa học.', data: { id: courseId, status } });
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật trạng thái khóa học.');
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = parseId(req.params.id);
    if (!courseId) return res.status(400).json({ success: false, message: 'Mã khóa học không hợp lệ.' });
    const course = await prisma.courses.findUnique({ where: { CourseID: courseId }, select: { CourseID: true } });
    if (!course) return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học.' });

    await prisma.courses.delete({ where: { CourseID: courseId } });
    return res.json({ success: true, message: 'Đã xóa khóa học.' });
  } catch (error) {
    return handleError(res, error, 'Không thể xóa khóa học.');
  }
};

module.exports = {
  getManagementData,
  createCategory,
  updateCategory,
  deleteCategory,
  createCourse,
  updateCourse,
  updateCourseStatus,
  updateCourseLock,
  deleteCourse
};
