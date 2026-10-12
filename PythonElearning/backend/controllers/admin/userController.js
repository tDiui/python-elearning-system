const { Prisma, PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const adminRoleNames = ['admin', 'quan tri vien'];
const studentRoleNames = ['student', 'sinh vien'];

const normalizeRoleName = (roleName = '') => String(roleName)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const parseRoleId = (value) => {
  const roleId = Number(value);
  return Number.isInteger(roleId) && roleId > 0 ? roleId : null;
};

const getAdminRoleIds = async (db) => {
  const roles = await db.roles.findMany({ select: { RoleID: true, RoleName: true } });
  return roles
    .filter((role) => adminRoleNames.includes(normalizeRoleName(role.RoleName)))
    .map((role) => role.RoleID);
};

const ensureActiveAdminRemains = async (db, user, nextRoleId, nextIsActive) => {
  const currentlyAdmin = adminRoleNames.includes(normalizeRoleName(user.Roles.RoleName));
  const remainsAdmin = nextRoleId === undefined
    ? currentlyAdmin
    : (await db.roles.findUnique({ where: { RoleID: nextRoleId } }).then((role) =>
      role && adminRoleNames.includes(normalizeRoleName(role.RoleName))));

  if (!user.IsActive || !currentlyAdmin || (remainsAdmin && nextIsActive !== false)) return;

  const adminRoleIds = await getAdminRoleIds(db);
  const activeAdminCount = await db.users.count({
    where: { IsActive: true, RoleID: { in: adminRoleIds } }
  });
  if (activeAdminCount <= 1) {
    throw httpError(409, 'Không thể khóa hoặc đổi vai trò của quản trị viên hoạt động cuối cùng.');
  }
};

const handleError = (res, error, defaultMessage) => {
  if (error.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Email hoặc mã sinh viên đã được sử dụng.' });
  }
  if (error.code === 'P2003') {
    return res.status(409).json({
      success: false,
      message: 'Không thể xóa người dùng vì tài khoản đang có dữ liệu liên quan. Có thể khóa tài khoản thay thế.'
    });
  }
  if (error.code === 'P2034') {
    return res.status(409).json({ success: false, message: 'Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại.' });
  }
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  console.error(defaultMessage, error);
  return res.status(500).json({ success: false, message: defaultMessage });
};

const getUsers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const roleId = req.query.roleId ? parseRoleId(req.query.roleId) : null;
    const status = String(req.query.status || 'all');
    if (req.query.roleId && !roleId) {
      return res.status(400).json({ success: false, message: 'Vai trò lọc không hợp lệ.' });
    }
    if (!['all', 'active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái lọc không hợp lệ.' });
    }

    const where = {
      ...(roleId ? { RoleID: roleId } : {}),
      ...(status === 'all' ? {} : { IsActive: status === 'active' }),
      ...(search ? {
        OR: [
          { FullName: { contains: search } },
          { Email: { contains: search } },
          { StudentID: { contains: search } },
          { Roles: { RoleName: { contains: search } } }
        ]
      } : {})
    };

    const [users, roles] = await Promise.all([
      prisma.users.findMany({
        where,
        include: { Roles: { select: { RoleID: true, RoleName: true } } },
        orderBy: { CreatedAt: 'desc' }
      }),
      prisma.roles.findMany({ orderBy: { RoleName: 'asc' } })
    ]);

    return res.json({
      success: true,
      data: {
        users: users.map((user) => ({
          id: user.UserID,
          fullName: user.FullName,
          email: user.Email,
          studentId: user.StudentID,
          role: { id: user.Roles.RoleID, name: user.Roles.RoleName },
          isActive: user.IsActive,
          createdAt: user.CreatedAt
        })),
        roles: roles.map((role) => ({ id: role.RoleID, name: role.RoleName }))
      }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể tải danh sách người dùng.');
  }
};

const createUser = async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const studentId = String(req.body.studentId || '').trim();
    const roleId = parseRoleId(req.body.roleId);

    if (!fullName || fullName.length > 100 || !email || email.length > 150
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || !roleId) {
      return res.status(400).json({ success: false, message: 'Vui lòng kiểm tra họ tên, email, mật khẩu và vai trò.' });
    }
    if (studentId.length > 50) {
      return res.status(400).json({ success: false, message: 'Mã sinh viên không được vượt quá 50 ký tự.' });
    }

    const role = await prisma.roles.findUnique({ where: { RoleID: roleId } });
    if (!role) return res.status(400).json({ success: false, message: 'Vai trò không tồn tại.' });
    if (studentRoleNames.includes(normalizeRoleName(role.RoleName)) && !studentId) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã sinh viên cho tài khoản sinh viên.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        FullName: fullName,
        Email: email,
        PasswordHash: passwordHash,
        StudentID: studentId || null,
        RoleID: roleId
      },
      include: { Roles: { select: { RoleID: true, RoleName: true } } }
    });

    return res.status(201).json({
      success: true,
      message: 'Đã thêm người dùng.',
      data: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        studentId: user.StudentID,
        role: { id: user.Roles.RoleID, name: user.Roles.RoleName },
        isActive: user.IsActive,
        createdAt: user.CreatedAt
      }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể thêm người dùng.');
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim();
    const studentId = String(req.body.studentId || '').trim();
    const shouldUpdateStudentId = Object.prototype.hasOwnProperty.call(req.body, 'studentId');
    const roleId = parseRoleId(req.body.roleId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }
    if (!fullName || fullName.length > 100 || !email || email.length > 150
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roleId
      || (shouldUpdateStudentId && studentId.length > 50)) {
      return res.status(400).json({ success: false, message: 'Vui lòng kiểm tra họ tên, email, mã sinh viên và vai trò.' });
    }

    const user = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.users.findUnique({
        where: { UserID: userId },
        include: { Roles: { select: { RoleName: true } } }
      });
      if (!currentUser) throw httpError(404, 'Không tìm thấy người dùng.');

      const nextRole = await tx.roles.findUnique({ where: { RoleID: roleId } });
      if (!nextRole) throw httpError(400, 'Vai trò không tồn tại.');
      const nextIsStudent = studentRoleNames.includes(normalizeRoleName(nextRole.RoleName));
      if (nextIsStudent && !(shouldUpdateStudentId ? studentId : currentUser.StudentID)) {
        throw httpError(400, 'Vui lòng nhập mã sinh viên cho tài khoản sinh viên.');
      }
      await ensureActiveAdminRemains(tx, currentUser, roleId, currentUser.IsActive);

      return tx.users.update({
        where: { UserID: userId },
        data: {
          FullName: fullName,
          Email: email,
          ...(shouldUpdateStudentId ? { StudentID: studentId || null } : {}),
          RoleID: roleId
        },
        include: { Roles: { select: { RoleID: true, RoleName: true } } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.json({
      success: true,
      message: 'Đã cập nhật người dùng.',
      data: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        studentId: user.StudentID,
        role: { id: user.Roles.RoleID, name: user.Roles.RoleName },
        isActive: user.IsActive,
        createdAt: user.CreatedAt
      }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật người dùng.');
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { isActive } = req.body;
    if (!Number.isInteger(userId) || userId <= 0 || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Thông tin trạng thái không hợp lệ.' });
    }

    const user = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.users.findUnique({
        where: { UserID: userId },
        include: { Roles: { select: { RoleName: true } } }
      });
      if (!currentUser) throw httpError(404, 'Không tìm thấy người dùng.');
      await ensureActiveAdminRemains(tx, currentUser, undefined, isActive);

      return tx.users.update({ where: { UserID: userId }, data: { IsActive: isActive } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.json({
      success: true,
      message: isActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.',
      data: { id: user.UserID, isActive: user.IsActive }
    });
  } catch (error) {
    return handleError(res, error, 'Không thể thay đổi trạng thái người dùng.');
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ.' });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { UserID: userId },
        include: { Roles: { select: { RoleName: true } } }
      });
      if (!user) throw httpError(404, 'Không tìm thấy người dùng.');
      if (user.UserID === req.user.userId) {
        throw httpError(409, 'Không thể xóa tài khoản quản trị viên đang đăng nhập.');
      }

      if (user.IsActive && adminRoleNames.includes(normalizeRoleName(user.Roles.RoleName))) {
        await ensureActiveAdminRemains(tx, user, undefined, false);
      }
      await tx.users.delete({ where: { UserID: userId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.json({ success: true, message: 'Đã xóa người dùng.' });
  } catch (error) {
    return handleError(res, error, 'Không thể xóa người dùng.');
  }
};

module.exports = { getUsers, createUser, updateUser, updateUserStatus, deleteUser };
