const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pylearn_secret_key_2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Từ chối truy cập: Không có Token!' });
  }

  const token = authHeader.split(' ')[1]; // Lấy phần token sau chữ 'Bearer'
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Giải mã thành công, lưu thông tin (userId, role) vào req
    next(); // Cho phép đi tiếp vào Controller
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token đã hết hạn hoặc không hợp lệ!' });
  }
};

module.exports = { verifyToken };