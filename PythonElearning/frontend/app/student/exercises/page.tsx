"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ExerciseItem {
  id: number;
  title: string;
  topicName: string;
  type: string;
  difficultyLevel: number;
  timeLimit: number;
}

export default function ExercisesDashboard() {
  const router = useRouter();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/student/exercises', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setExercises(data.data);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách bài tập', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, []);

  if (loading) return <div className="p-8 h-screen flex justify-center items-center text-gray-500">Đang tải thư viện bài tập...</div>;

  return (
    <div className="p-8 min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Thư viện Bài tập</h1>
          <p className="text-gray-500 text-sm">Luyện tập kỹ năng lập trình với hệ thống test case tự động.</p>
        </div>
        <div className="relative w-72">
          <span className="absolute left-3 top-2 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm bài tập..." 
            className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
          />
        </div>
      </div>

      {/* Grid danh sách bài tập */}
      {exercises.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-gray-200 text-center text-gray-500">
          Chưa có bài tập nào trong cơ sở dữ liệu.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {exercises.map((ex) => (
            <div key={ex.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col justify-between h-full">
              
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">💻</div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
                    ${ex.difficultyLevel === 1 ? 'text-emerald-600 bg-emerald-50' : 
                      ex.difficultyLevel === 2 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
                    {ex.difficultyLevel === 1 ? 'Dễ' : ex.difficultyLevel === 2 ? 'Trung bình' : 'Khó'}
                  </span>
                </div>
                
                <h3 className="font-bold text-gray-900 text-[16px] mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">{ex.title}</h3>
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5"><span className="text-red-400">🎯</span> Topic: {ex.topicName}</p>
              </div>
              
              <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {ex.timeLimit} phút
                </span>
                
                <button 
                  onClick={() => router.push(`/student/exercises/${ex.id}`)}
                  className="text-blue-600 text-sm font-bold bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                >
                  Làm bài ›
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}