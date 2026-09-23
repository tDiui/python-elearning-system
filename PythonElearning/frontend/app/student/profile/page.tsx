"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Định nghĩa cấu trúc dữ liệu
type Skill = {
  name: string;
  score: number;
  status: 'Thành thạo' | 'Đang tiến bộ' | 'Cần luyện tập' | 'Tốt';
  trend: string;
};

type ProfileData = {
  overallMastery: number;
  masteryLevel: string;
  avgScore: number;
  avgScoreStatus: string;
  studyConsistency: number;
  consistencyFreq: string;
  totalStudyTime: string;
  studyTimePeriod: string;
  streak: number;
  streakStatus: string;
  knowledgeMastery: Skill[];
  strengths: { name: string; score: number }[];
  weaknesses: { name: string; suggestion: string }[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/student/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Lỗi tải dữ liệu profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  // Hàm helper để render style thanh tiến độ
  const getProgressStyle = (status: string, score: number) => {
    let color = 'bg-blue-600';
    if (status === 'Thành thạo') color = 'bg-emerald-500';
    else if (status === 'Đang tiến bộ') color = 'bg-amber-500';
    else if (status === 'Cần luyện tập') color = 'bg-red-500';

    return (
      <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${score}%` }}></div>
      </div>
    );
  };

  const getStatusTextColor = (status: string) => {
    if (status === 'Thành thạo') return 'text-emerald-600';
    if (status === 'Đang tiến bộ') return 'text-amber-600';
    if (status === 'Cần luyện tập') return 'text-red-500';
    return 'text-blue-600';
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-gray-500 font-medium flex items-center gap-2">
          <span className="animate-spin text-2xl">↻</span> Đang tải hồ sơ năng lực...
        </div>
      </div>
    );
  }

  // TRẠNG THÁI TRỐNG (Khi tài khoản mới chưa có dữ liệu học tập)
  if (!data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Hồ sơ năng lực học tập</h1>
          <p className="text-sm text-gray-500">Cách hệ thống đánh giá tiến độ học tập của bạn</p>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] bg-white rounded-3xl border border-gray-100 shadow-sm text-center p-8">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">📊</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Hồ sơ chưa có dữ liệu</h2>
          <p className="text-gray-500 mb-8 max-w-md leading-relaxed">Bạn cần hoàn thành ít nhất một vài bài học hoặc bài kiểm tra để AI có thể đánh giá và xây dựng hồ sơ năng lực cho bạn.</p>
          <Link href="/student/courses" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md">
            Bắt đầu học ngay
          </Link>
        </div>
      </div>
    );
  }

  // TRẠNG THÁI CÓ DỮ LIỆU
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-12">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Hồ sơ năng lực học tập</h1>
        <p className="text-sm text-gray-500">Cách hệ thống đánh giá tiến độ học tập của bạn</p>
      </div>

      {/* TỔNG QUAN (5 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <span className="text-2xl mb-2">🎯</span>
          <p className="text-2xl font-bold text-blue-700">{data.overallMastery}%</p>
          <p className="text-xs font-bold text-gray-800 mt-1">Overall Mastery</p>
          <p className="text-[10px] text-gray-400">{data.masteryLevel}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <span className="text-2xl mb-2">📊</span>
          <p className="text-2xl font-bold text-teal-600">{data.avgScore}%</p>
          <p className="text-xs font-bold text-gray-800 mt-1">Avg Score</p>
          <p className="text-[10px] text-gray-400">{data.avgScoreStatus}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <span className="text-2xl mb-2">🗓️</span>
          <p className="text-2xl font-bold text-indigo-600">{data.studyConsistency}%</p>
          <p className="text-xs font-bold text-gray-800 mt-1">Study Consistency</p>
          <p className="text-[10px] text-gray-400">{data.consistencyFreq}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <span className="text-2xl mb-2">⏱️</span>
          <p className="text-2xl font-bold text-gray-900">{data.totalStudyTime}</p>
          <p className="text-xs font-bold text-gray-800 mt-1">Total Study Time</p>
          <p className="text-[10px] text-gray-400">{data.studyTimePeriod}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <span className="text-2xl mb-2">🔥</span>
          <p className="text-2xl font-bold text-orange-500">{data.streak} ngày</p>
          <p className="text-xs font-bold text-gray-800 mt-1">Streak</p>
          <p className="text-[10px] text-gray-400">{data.streakStatus}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI: KNOWLEDGE MASTERY */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900">Knowledge Mastery</h3>
            <div className="flex gap-4 text-[10px] text-gray-500 font-medium">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Thành thạo ≥80%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Đang tiến bộ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Cần luyện tập</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-5">
            {data.knowledgeMastery.map((skill, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-end mb-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800">{skill.name}</span>
                    <span className={`text-[10px] font-bold ${getStatusTextColor(skill.status)}`}>{skill.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-500 text-xs font-medium">↗ {skill.trend}</span>
                    <span className="font-bold text-gray-900">{skill.score}%</span>
                  </div>
                </div>
                {getProgressStyle(skill.status, skill.score)}
              </div>
            ))}
          </div>
        </div>

        {/* CỘT PHẢI: RADAR, ĐIỂM MẠNH, CẦN LUYỆN THÊM */}
        <div className="flex flex-col gap-6">
          
          {/* Skill Radar Placeholder */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[250px]">
             <h3 className="font-bold text-gray-900 self-start mb-4">Skill Radar</h3>
             <div className="flex-1 flex items-center justify-center w-full relative">
                {/* Ở môi trường thực tế, bạn sẽ dùng thư viện như Recharts hoặc Chart.js để vẽ Radar chart */}
                <div className="text-gray-300 text-sm italic">Biểu đồ Radar sẽ hiển thị tại đây khi có đủ dữ liệu</div>
             </div>
          </div>

          {/* Điểm mạnh */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <span className="text-emerald-500">✅</span> Điểm mạnh
            </h3>
            <div className="flex flex-col gap-3">
              {data.strengths.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{item.name}</span>
                  <span className="font-bold text-emerald-600">{item.score}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cần luyện thêm */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <span className="text-red-500">🎯</span> Cần luyện thêm <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold ml-1">✦ AI</span>
            </h3>
            <div className="flex flex-col gap-3">
               {data.weaknesses.map((item, idx) => (
                  <div key={idx} className="text-sm flex flex-col gap-1">
                    <span className="font-semibold text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-500">{item.suggestion}</span>
                  </div>
               ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}