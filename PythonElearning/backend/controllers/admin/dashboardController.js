const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAdminDashboard = async (req, res) => {
  try {
    // ==========================================
    // 1. LẤY SỐ LIỆU TỔNG QUAN (CARDS)
    // ==========================================
    const totalUsers = await prisma.users.count();
    const students = await prisma.users.count({ where: { RoleID: 3 } }); // Giả định RoleID 3 là Student
    const instructors = await prisma.users.count({ where: { RoleID: 2 } }); // Giả định RoleID 2 là Instructor
    const courses = await prisma.courses.count();
    
    // Đếm tổng số lần AI sinh lộ trình / gợi ý
    const aiRequests = await prisma.aIGenerations.count();
    
    // Tính điểm trung bình Master toàn hệ thống
    const learningStats = await prisma.studentLearningStats.findMany();
    const avgMastery = learningStats.length > 0 
      ? Math.round(learningStats.reduce((sum, stat) => sum + stat.AverageScore, 0) / learningStats.length)
      : 0;


    // ==========================================
    // 2. BIỂU ĐỒ USER ACTIVITY (7 NGÀY QUA TỪ DB THẬT)
    // ==========================================
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Lấy mọi hoạt động trong 7 ngày qua từ bảng LearningActivities
    const recentActivities = await prisma.learningActivities.findMany({
      where: { CreatedAt: { gte: sevenDaysAgo } },
      select: { UserID: true, CreatedAt: true }
    });

    const daysMap = {};
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    // Khởi tạo mảng 7 ngày (để những ngày không có ai học vẫn hiện trên biểu đồ)
    for(let i = 0; i <= 6; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const dayStr = dayNames[d.getDay()]; 
        daysMap[dayStr] = { name: dayStr, totalActions: 0, uniqueUsers: new Set() };
    }

    // Phân bổ dữ liệu thật vào từng ngày
    recentActivities.forEach(act => {
        const dayStr = dayNames[new Date(act.CreatedAt).getDay()];
        if(daysMap[dayStr]) {
            daysMap[dayStr].totalActions += 1; // Số lượt tương tác (đường Area)
            daysMap[dayStr].uniqueUsers.add(act.UserID); // User thực tế đang online (đường Line)
        }
    });

    const userActivityData = Object.values(daysMap).map(d => ({
        name: d.name,
        users: d.totalActions, 
        active: d.uniqueUsers.size 
    }));


    // ==========================================
    // 3. BIỂU ĐỒ AI REQUESTS (TRONG NGÀY HÔM NAY)
    // ==========================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Lấy các lệnh gọi AI trong ngày hôm nay
    const aiGen = await prisma.aIGenerations.findMany({
        where: { GeneratedAt: { gte: today } },
        select: { GeneratedAt: true }
    });

    const hoursMap = { '6h': 0, '8h': 0, '10h': 0, '12h': 0, '14h': 0, '16h': 0, '18h': 0, '20h': 0, '22h': 0 };
    
    aiGen.forEach(ai => {
        const hour = new Date(ai.GeneratedAt).getHours();
        // Phân bổ vào các mốc thời gian
        if (hour <= 6) hoursMap['6h']++;
        else if (hour <= 8) hoursMap['8h']++;
        else if (hour <= 10) hoursMap['10h']++;
        else if (hour <= 12) hoursMap['12h']++;
        else if (hour <= 14) hoursMap['14h']++;
        else if (hour <= 16) hoursMap['16h']++;
        else if (hour <= 18) hoursMap['18h']++;
        else if (hour <= 20) hoursMap['20h']++;
        else hoursMap['22h']++;
    });

    const aiRequestsData = Object.keys(hoursMap).map(key => ({
        time: key,
        reqs: hoursMap[key]
    }));


    // ==========================================
    // 4. LỊCH SỬ HOẠT ĐỘNG GẦN ĐÂY (REAL-TIME LOG)
    // ==========================================
    // Lấy 5 hoạt động mới nhất, kết hợp (Join) với bảng Users và Exercises để báo cáo rõ ràng
    const recentLogs = await prisma.learningActivities.findMany({
      take: 5,
      orderBy: { CreatedAt: 'desc' },
      include: { 
          Users: { select: { FullName: true } },
          Exercises: { select: { Title: true } },
          Lessons: { select: { Title: true } }
      }
    });

    const activityLogs = recentLogs.map(log => {
        let actionDesc = "vừa có hoạt động học tập mới";
        
        // Tùy biến câu thông báo dựa vào loại hành động
        if (log.ActionType === 'Submit_Exercise') {
            actionDesc = `vừa nộp bài tập: ${log.Exercises?.Title || ''} (Điểm: ${log.Score})`;
        } else if (log.LessonID) {
            actionDesc = `vừa hoàn thành bài học: ${log.Lessons?.Title || ''}`;
        }

        return {
            message: `${log.Users?.FullName || 'Học viên'} ${actionDesc}`,
            time: log.CreatedAt
        };
    });


    // ==========================================
    // TRẢ DỮ LIỆU VỀ FRONTEND
    // ==========================================
    res.status(200).json({
      success: true,
      data: {
        summary: { totalUsers, students, instructors, courses, aiRequests, avgMastery },
        userActivityData,
        aiRequestsData,
        activityLogs
      }
    });

  } catch (error) {
    console.error('Lỗi lấy Admin Dashboard:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu thống kê' });
  }
};

module.exports = { getAdminDashboard };