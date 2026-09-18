"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// === ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU ĐỘNG ===
type KnowledgeSkill = {
  name: string;
  score: number;
  color: string;
  warning?: string;
};

type PathItem = {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  reason: string;
  durationMinutes: number;
  isLocked: boolean;
};

type CurrentCourseProgress = {
  courseName: string;
  chapterInfo: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
};

type StudentDashboardData = {
  fullName?: string;
  overallMastery?: number;
  totalLessonsLearned?: number;
  avgScore?: number;
  studyTimeHours?: number;
  completedExercises?: number;
  currentCourse?: CurrentCourseProgress | null;
  learningPath?: PathItem[];
  knowledgeMap?: KnowledgeSkill[];
  aiInsight?: string | null;
};

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // GỌI API LẤY DỮ LIỆU THẬT
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/student/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [router]);

  // Hàm tạo màu sắc dựa trên độ khó của bài học
  const getDifficultyStyles = (difficulty: string) => {
    switch(difficulty.toLowerCase()) {
      case 'easy': return 'text-emerald-600 bg-emerald-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'hard': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-gray-500 font-medium flex items-center gap-2">
          <span className="animate-spin text-2xl">↻</span> Đang tải dữ liệu học tập...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      
      {/* ================= HERO BANNER ================= */}
      <div className="bg-[#1956E3] rounded-2xl p-8 text-white flex justify-between items-center shadow-sm relative overflow-hidden">
        <div className="relative z-10 w-full">
          
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-blue-100 text-sm mb-1">Xin chào 👋</p>
              <h1 className="text-3xl font-bold mb-1">
                Chào bạn, {data?.fullName ? data.fullName.split(' ').pop() : '...'}!
              </h1>
              <p className="text-blue-100 text-sm">Tiếp tục hành trình học Python của bạn.</p>
            </div>
            <div className="flex gap-8 text-right">
              <div>
                <p className="text-3xl font-bold">{data?.overallMastery || 0}%</p>
                <p className="text-blue-100 text-xs mt-1">Overall Mastery</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{data?.totalLessonsLearned || 0}</p>
                <p className="text-blue-100 text-xs mt-1">Bài đã học</p>
              </div>
            </div>
          </div>

          {/* DỮ LIỆU ĐỘNG 1: KHÓA HỌC ĐANG HỌC */}
          {data?.currentCourse ? (
            <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between backdrop-blur-sm border border-white/10">
              <div className="flex-1 mr-8">
                <p className="font-semibold text-sm">{data.currentCourse.courseName}</p>
                <p className="text-xs text-blue-200 mb-3">{data.currentCourse.chapterInfo}</p>
                <div className="w-full bg-black/20 rounded-full h-1.5">
                  <div className="bg-white h-1.5 rounded-full" style={{ width: `${data.currentCourse.progressPercent}%` }}></div>
                </div>
                <p className="text-[10px] text-blue-200 mt-2">
                  {data.currentCourse.progressPercent}% hoàn thành 
                  <span className="float-right">{data.currentCourse.completedLessons}/{data.currentCourse.totalLessons} bài</span>
                </p>
              </div>
              <button className="bg-white text-blue-600 font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-blue-50 transition-colors shadow-sm whitespace-nowrap">
                ▶ Tiếp tục học
              </button>
            </div>
          ) : (
            /* TRẠNG THÁI TRỐNG KHI CHƯA HỌC KHÓA NÀO */
            <div className="bg-white/10 rounded-xl p-6 flex flex-col items-center justify-center backdrop-blur-sm border border-white/10 text-center">
              <p className="text-white font-medium mb-3">Bạn chưa tham gia khóa học nào.</p>
              <Link href="#" className="bg-white text-blue-600 font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-blue-50 transition-colors shadow-sm">
                Khám phá khóa học ngay
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ================= CỘT TRÁI: LỘ TRÌNH HỌC TẬP ================= */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 min-h-75">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Lộ trình hôm nay</h2>
                <p className="text-xs text-gray-500 mt-1">Được AI cá nhân hóa dựa trên dữ liệu học tập của bạn.</p>
              </div>
              {data?.learningPath && data.learningPath.length > 0 && (
                <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  ✦ AI Personalized
                </span>
              )}
            </div>

            {/* DỮ LIỆU ĐỘNG 2: DANH SÁCH LỘ TRÌNH */}
            {data?.learningPath && data.learningPath.length > 0 ? (
              <div className="flex flex-col gap-4">
                {data.learningPath.map((item, index) => (
                  <div key={item.id} className={`flex items-center gap-4 p-4 rounded-xl border ${item.isLocked ? 'border-gray-100 opacity-60' : 'border-gray-100 bg-gray-50/50 hover:border-blue-100'} transition-colors`}>
                    <div className={`w-10 h-10 rounded-full ${item.isLocked ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'} font-bold flex items-center justify-center shrink-0`}>
                      {item.isLocked ? '🔒' : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold ${item.isLocked ? 'text-gray-500' : 'text-gray-900'}`}>{item.title}</p>
                        <span className={`text-[10px] font-bold ${getDifficultyStyles(item.difficulty)} px-2 py-0.5 rounded`}>{item.difficulty}</span>
                      </div>
                      <p className={`text-xs ${item.isLocked ? 'text-gray-400' : 'text-gray-500'}`}>✦ {item.reason}</p>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mr-2">⏱ {item.durationMinutes} phút</div>
                    <button className={`${item.isLocked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} px-4 py-2 rounded-lg text-sm font-medium`}>
                      {item.isLocked ? 'Chưa mở' : 'Học ngay'}
                    </button>
                  </div>
                ))}
                <button className="text-sm text-blue-600 font-medium mt-4 hover:underline self-start">Xem toàn bộ lộ trình ›</button>
              </div>
            ) : (
              /* TRẠNG THÁI TRỐNG KHI CHƯA CÓ LỘ TRÌNH */
              <div className="py-12 flex flex-col items-center justify-center text-center mt-4">
                <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center text-3xl mb-4">🗺️</div>
                <p className="text-sm font-bold text-gray-700 mb-1">Chưa có lộ trình học tập</p>
                <p className="text-xs text-gray-500 max-w-xs">AI cần bạn thực hiện ít nhất một bài đánh giá hoặc học một bài cơ bản để tạo lộ trình.</p>
              </div>
            )}
          </div>
        </div>

        {/* ================= CỘT PHẢI: THỐNG KÊ ================= */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Learning Progress</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-red-500 text-lg mb-1 block">🎯</span>
                <p className="text-xl font-bold text-gray-900">{data?.avgScore || 0}%</p>
                <p className="text-[10px] text-gray-500">Avg Score ~</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600 text-lg mb-1 block">⏱️</span>
                <p className="text-xl font-bold text-gray-900">{data?.studyTimeHours || 0}h</p>
                <p className="text-[10px] text-gray-500">Study Time ~</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-green-500 text-lg mb-1 block">✅</span>
                <p className="text-xl font-bold text-gray-900">{data?.totalLessonsLearned || 0}</p>
                <p className="text-[10px] text-gray-500">Completed</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600 text-lg mb-1 block">💻</span>
                <p className="text-xl font-bold text-gray-900">{data?.completedExercises || 0}</p>
                <p className="text-[10px] text-gray-500">Exercises ~</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Knowledge Map</h3>
              {data?.knowledgeMap && data.knowledgeMap.length > 0 && (
                <button className="text-[11px] text-blue-600 font-medium">Chi tiết</button>
              )}
            </div>
            
            {/* DỮ LIỆU ĐỘNG 3: BẢN ĐỒ KIẾN THỨC */}
            {data?.knowledgeMap && data.knowledgeMap.length > 0 ? (
              <div className="flex flex-col gap-3">
                {data.knowledgeMap.map((skill: KnowledgeSkill, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-gray-600 truncate" title={skill.name}>{skill.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className={`${skill.color} h-1.5 rounded-full`} style={{ width: `${skill.score}%` }}></div>
                    </div>
                    <span className="w-8 text-right font-semibold text-gray-700">{skill.score}%</span>
                    {skill.warning && <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{skill.warning}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-400">Chưa có dữ liệu phân tích kỹ năng.</p>
              </div>
            )}
          </div>

          {/* DỮ LIỆU ĐỘNG 4: AI INSIGHT (Chỉ hiện ra khi có dữ liệu thật) */}
          {data?.aiInsight && (
            <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs">✦</div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">AI Insight</h4>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">
                    {data.aiInsight}
                  </p>
                  <button className="text-xs text-blue-600 font-medium hover:underline">Xem lộ trình ›</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}