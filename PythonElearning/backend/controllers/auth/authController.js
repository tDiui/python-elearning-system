const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
// Khóa bí mật để tạo Token (Sau này nên đưa vào file .env)
const JWT_SECRET = process.env.JWT_SECRET || 'pylearn_secret_key_2026';

// 1. XỬ LÝ ĐĂNG KÝ (REGISTER)
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, studentId } = req.body;
    const fullName = `${firstName} ${lastName}`.trim();
    const normalizedStudentId = String(studentId || '').trim();

    if (!normalizedStudentId) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã sinh viên!' });
    }

    const existingUserByEmail = await prisma.users.findUnique({ where: { Email: email } });
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
        Email: email,
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
    const { email, password } = req.body;

    // Tìm User theo email và lấy kèm thông tin bảng Roles
    const user = await prisma.users.findUnique({
      where: { Email: email },
      include: { Roles: true } 
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản!' });
    }

    // So sánh mật khẩu người dùng nhập với mật khẩu đã mã hóa trong DB
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Sai mật khẩu!' });
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
// 3. XỬ LÝ QUÊN MẬT KHẨU (Gửi yêu cầu)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Kiểm tra email có tồn tại không
    const user = await prisma.users.findUnique({ where: { Email: email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email này chưa được đăng ký!' });
    }

    // LƯU Ý: Trong dự án thực tế, đoạn này bạn sẽ dùng thư viện Nodemailer 
    // để gửi một Email chứa mã OTP hoặc Link xác nhận đến cho người dùng.
    // Hiện tại chúng ta giả lập phản hồi thành công để làm tiếp Frontend.
    
    res.status(200).json({ 
      success: true, 
      message: 'Yêu cầu khôi phục thành công! (Giả lập: Đã gửi email hướng dẫn)' 
    });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// 4. XỬ LÝ ĐẶT LẠI MẬT KHẨU MỚI (Reset Password)
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật vào SQL Server
    await prisma.users.update({
      where: { Email: email },
      data: { PasswordHash: hashedPassword }
    });

    res.status(200).json({ success: true, message: 'Đổi mật khẩu mới thành công! Bạn có thể đăng nhập.' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi mật khẩu' });
  }
};
module.exports = { register, login, forgotPassword, resetPassword };