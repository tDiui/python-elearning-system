const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();
// Khóa bí mật để tạo Token (Sau này nên đưa vào file .env)
const JWT_SECRET = process.env.JWT_SECRET || 'pylearn_secret_key_2026';

const normalizeRoleName = (roleName = '') => {
  return String(roleName)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const allowedLoginRoles = ['sinh vien', 'student', 'giang vien', 'teacher', 'admin', 'quan tri vien'];
const passwordResetRequestMessage = 'Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư.';

const getPasswordResetSecret = () => {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PASSWORD_RESET_SECRET phải được cấu hình với ít nhất 32 ký tự.');
  }
  return secret;
};

const getPasswordResetSigningKey = (passwordHash) => crypto
  .createHmac('sha256', getPasswordResetSecret())
  .update(passwordHash)
  .digest();

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number.parseInt(process.env.SMTP_PORT || '', 10);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureValue ? secureValue === 'true' : port === 465;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD và SMTP_FROM phải được cấu hình.');
  }
  if (secureValue && !['true', 'false'].includes(secureValue)) {
    throw new Error('SMTP_SECURE chỉ nhận true hoặc false.');
  }
  return { host, port, secure, user, password, from };
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getFrontendUrl = () => {
  const configuredUrl = process.env.FRONTEND_URL;
  if (!configuredUrl) throw new Error('FRONTEND_URL chưa được cấu hình.');
  const frontendUrl = new URL(configuredUrl);
  if (!['http:', 'https:'].includes(frontendUrl.protocol) || frontendUrl.username || frontendUrl.password) {
    throw new Error('FRONTEND_URL không hợp lệ.');
  }
  return frontendUrl.toString().replace(/\/$/, '');
};

// 1. XỬ LÝ ĐĂNG KÝ (REGISTER)
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, studentId } = req.body || {};
    const normalizedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const normalizedLastName = typeof lastName === 'string' ? lastName.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const normalizedStudentId = typeof studentId === 'string' ? studentId.trim() : '';

    if (!normalizedFirstName || !normalizedLastName || fullName.length > 100) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ họ tên hợp lệ.' });
    }
    if (
      !normalizedEmail ||
      normalizedEmail.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ.' });
    }
    if (!normalizedStudentId || normalizedStudentId.length > 50) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã sinh viên hợp lệ.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có từ 6 đến 128 ký tự.' });
    }

    const existingUserByEmail = await prisma.users.findUnique({ where: { Email: normalizedEmail } });
    if (existingUserByEmail) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng!' });
    }

    const existingUserByStudentId = await prisma.users.findFirst({
      where: { StudentID: normalizedStudentId }
    });
    if (existingUserByStudentId) {
      return res.status(400).json({ success: false, message: 'Mã sinh viên này đã được đăng ký!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let studentRole = await prisma.roles.findFirst({ where: { RoleName: 'Sinh viên' } });
    if (!studentRole) {
      studentRole = await prisma.roles.create({ data: { RoleName: 'Sinh viên' } });
    }

    await prisma.users.create({
      data: {
        FullName: fullName,
        StudentID: normalizedStudentId,
        Email: normalizedEmail,
        PasswordHash: hashedPassword,
        RoleID: studentRole.RoleID,
      }
    });

    res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng ký' });
  }
};

// 2. XỬ LÝ ĐĂNG NHẬP (LOGIN)
const login = async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || email.length > 150 || !password || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    // Tìm User theo email và lấy kèm thông tin bảng Roles
    const user = await prisma.users.findUnique({
      where: { Email: email },
      include: { Roles: true } 
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (!user.IsActive) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.' });
    }

    // So sánh mật khẩu người dùng nhập với mật khẩu đã mã hóa trong DB
    const isMatch = user.PasswordHash
      ? await bcrypt.compare(password, user.PasswordHash)
      : false;
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const normalizedRole = normalizeRoleName(user.Roles?.RoleName || '');
    if (!allowedLoginRoles.includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này không có quyền đăng nhập vào hệ thống.'
      });
    }

    // Tạo JWT Token có thời hạn 1 ngày
    const token = jwt.sign(
      { userId: user.UserID, role: user.Roles.RoleName },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        role: user.Roles.RoleName
      }
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập' });
  }
};

const getAccountProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Không xác định được tài khoản.' });
    }

    const user = await prisma.users.findUnique({
      where: { UserID: userId },
      select: {
        FullName: true,
        Email: true,
        StudentID: true,
        Roles: { select: { RoleName: true } }
      }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    return res.json({
      success: true,
      data: {
        fullName: user.FullName,
        email: user.Email,
        studentId: user.StudentID,
        role: user.Roles.RoleName
      }
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông tin tài khoản.' });
  }
};

const updateAccountProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Không xác định được tài khoản.' });
    }

    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!fullName || fullName.length > 100) {
      return res.status(400).json({ success: false, message: 'Họ tên bắt buộc và tối đa 100 ký tự.' });
    }
    if (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ.' });
    }

    const existingEmail = await prisma.users.findFirst({
      where: { Email: email, UserID: { not: userId } },
      select: { UserID: true }
    });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email này đã được sử dụng bởi tài khoản khác.' });
    }

    const user = await prisma.users.update({
      where: { UserID: userId },
      data: { FullName: fullName, Email: email },
      select: {
        FullName: true,
        Email: true,
        StudentID: true,
        Roles: { select: { RoleName: true } }
      }
    });

    return res.json({
      success: true,
      message: 'Đã cập nhật thông tin tài khoản.',
      data: {
        fullName: user.FullName,
        email: user.Email,
        studentId: user.StudentID,
        role: user.Roles.RoleName
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Email này đã được sử dụng bởi tài khoản khác.' });
    }
    console.error('Lỗi cập nhật thông tin tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông tin tài khoản.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Không xác định được tài khoản.' });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có từ 6 đến 128 ký tự.' });
    }
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại.' });
    }

    const user = await prisma.users.findUnique({
      where: { UserID: userId },
      select: { PasswordHash: true }
    });
    if (!user?.PasswordHash || !(await bcrypt.compare(currentPassword, user.PasswordHash))) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
    }
    if (await bcrypt.compare(newPassword, user.PasswordHash)) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({
      where: { UserID: userId },
      data: { PasswordHash: hashedPassword }
    });

    return res.json({ success: true, message: 'Đã đổi mật khẩu thành công.' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này.' });
  }
};

const forgotPassword = async (req, res) => {
  let smtpConfig;
  let resetUrl;
  try {
    smtpConfig = getSmtpConfig();
    getPasswordResetSecret();
    resetUrl = getFrontendUrl();
  } catch (error) {
    console.error('Cấu hình khôi phục mật khẩu chưa hợp lệ:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Chức năng khôi phục mật khẩu chưa được cấu hình đầy đủ trên máy chủ.'
    });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { Email: email },
      select: { UserID: true, FullName: true, Email: true, PasswordHash: true }
    });
    if (!user?.PasswordHash) {
      return res.json({ success: true, message: passwordResetRequestMessage });
    }

    const token = jwt.sign(
      { userId: user.UserID, purpose: 'password-reset' },
      getPasswordResetSigningKey(user.PasswordHash),
      { expiresIn: '15m' }
    );
    const recoveryLink = `${resetUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const safeName = escapeHtml(user.FullName || 'bạn');
    const safeRecoveryLink = escapeHtml(recoveryLink);
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    await transporter.sendMail({
      from: smtpConfig.from,
      to: user.Email,
      subject: 'Đặt lại mật khẩu PyLearn',
      text: `Xin chào ${user.FullName || 'bạn'},\n\nMở liên kết sau để đặt lại mật khẩu (liên kết hết hạn sau 15 phút và chỉ dùng một lần):\n${recoveryLink}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Xin chào ${safeName},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu PyLearn. Liên kết chỉ dùng một lần và hết hạn sau 15 phút:</p><p><a href="${safeRecoveryLink}">Đặt lại mật khẩu</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
    });

    return res.json({ success: true, message: passwordResetRequestMessage });
  } catch (error) {
    console.error('Lỗi xử lý yêu cầu khôi phục mật khẩu:', error);
    return res.status(503).json({
      success: false,
      message: 'Không thể gửi email khôi phục lúc này. Vui lòng thử lại sau.'
    });
  }
};

const resetPassword = async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!token || newPassword.length < 6 || newPassword.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'Liên kết không hợp lệ hoặc mật khẩu mới không đáp ứng yêu cầu (6–128 ký tự).'
    });
  }

  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object' || !Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) {
      return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    const user = await prisma.users.findUnique({
      where: { UserID: decoded.userId },
      select: { PasswordHash: true }
    });
    if (!user?.PasswordHash) {
      return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    let verifiedToken;
    try {
      verifiedToken = jwt.verify(token, getPasswordResetSigningKey(user.PasswordHash));
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
      }
      throw error;
    }
    if (
      typeof verifiedToken !== 'object' ||
      verifiedToken.purpose !== 'password-reset' ||
      verifiedToken.userId !== decoded.userId
    ) {
      return res.status(400).json({ success: false, message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.users.updateMany({
      where: { UserID: decoded.userId, PasswordHash: user.PasswordHash },
      data: { PasswordHash: hashedPassword }
    });
    if (updated.count !== 1) {
      return res.status(400).json({ success: false, message: 'Liên kết đã được sử dụng hoặc không còn hợp lệ.' });
    }

    return res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Không thể đặt lại mật khẩu lúc này.' });
  }
};
module.exports = { register, login, getAccountProfile, updateAccountProfile, changePassword, forgotPassword, resetPassword };