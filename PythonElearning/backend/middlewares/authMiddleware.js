const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const JWT_SECRET = process.env.JWT_SECRET || 'pylearn_secret_key_2026';
const prisma = new PrismaClient();

const normalizeRoleName = (roleName = '') => String(roleName)
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const adminRoleNames = ['admin', 'quan tri vien'];

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Từ chối truy cập: Không có Token!' });
  }

  const token = authHeader.split(' ')[1]; // Lấy phần token sau chữ 'Bearer'

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token đã hết hạn hoặc không hợp lệ!' });
  }

  if (!decoded || typeof decoded !== 'object' || !Number.isInteger(decoded.userId)) {
    return res.status(403).json({ success: false, message: 'Token đã hết hạn hoặc không hợp lệ!' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { UserID: decoded.userId },
      select: {
        UserID: true,
        IsActive: true,
        Roles: { select: { RoleName: true } }
      }
    });

    if (!user || !user.IsActive) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    }

    req.user = { ...decoded, userId: user.UserID, role: user.Roles.RoleName };
    return next();
  } catch (error) {
    console.error('Lỗi xác thực tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể xác thực tài khoản lúc này.' });
  }
};

const requireAdmin = (req, res, next) => {
  const roleName = normalizeRoleName(req.user?.role || '');
  if (!adminRoleNames.includes(roleName)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản trị người dùng.' });
  }
  return next();
};

module.exports = { verifyToken, requireAdmin };