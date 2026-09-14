const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 1. Import Prisma Client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

// API kiểm tra trạng thái Backend
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend Node.js đang hoạt động tốt!' });
});

// 2. API Test kết nối SQL Server
app.get('/api/test-db', async (req, res) => {
  try {
    // Thử thêm 1 Role "Admin" vào SQL Server 
    // (Dùng upsert để nếu f5 nhiều lần không bị lỗi trùng lặp)
    await prisma.roles.upsert({
      where: { RoleName: 'Admin' },
      update: {},
      create: { RoleName: 'Admin' },
    });

    // Lấy toàn bộ dữ liệu trong bảng Roles ra
    const allRoles = await prisma.roles.findMany();

    // Trả kết quả về cho trình duyệt
    res.json({
      success: true,
      message: 'Kết nối SQL Server qua Prisma THÀNH CÔNG RỰC RỠ!',
      data: allRoles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi kết nối DB', 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend đang chạy tại http://localhost:${PORT}`);
});