"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

// Định nghĩa kiểu dữ liệu mapping với Backend
type LessonData = {
  id: number;
  title: string;
  chapter: string;
  duration: number;
  difficulty: string;
  hasVideo: boolean;
  videoUrl: string | null;
  hasSlide: boolean;
  slideUrl: string | null;
  hasArticle: boolean;
  articleContent: string | null;
};

export default function LearnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lấy ID bài học từ URL (ví dụ: ?id=1). Nếu không có, mặc định là 1.
  const lessonId = searchParams.get('id') || '1'; 

  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'slide' | 'article'>('article');

  // GỌI API LẤY DỮ LIỆU BÀI HỌC
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(`http://localhost:5000/api/student/learn?id=${lessonId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        
        if (result.success && result.data) {
          setLessonData(result.data);
          
          // Tự động quyết định Tab nào được mở đầu tiên dựa trên nội dung bài học
          if (result.data.hasVideo) setActiveTab('video');
          else if (result.data.hasSlide) setActiveTab('slide');
          else setActiveTab('article');
        }
      } catch (error) {
        console.error('Lỗi tải bài học:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId, router]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-gray-500 font-medium flex items-center gap-2">
          <span className="animate-spin text-2xl">↻</span> Đang chuẩn bị bài học...
        </div>
      </div>
    );
  }

  // TRẠNG THÁI TRỐNG (Khi DB chưa có bài học nào)
  if (!lessonData) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] bg-white rounded-2xl border border-gray-100 shadow-sm text-center p-8 max-w-[1400px] mx-auto">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mb-4">📭</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy bài học</h2>
        <p className="text-gray-500 mb-6 max-w-md text-sm">Bài học bạn yêu cầu không tồn tại hoặc chưa được cập nhật dữ liệu vào hệ thống.</p>
        <Link href="/student/courses" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          Quay lại danh sách khóa học
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto h-[calc(100vh-80px)]">
      
      {/* 1. CỘT TRÁI: DANH SÁCH BÀI HỌC */}
      <div className="w-full lg:w-64 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col shrink-0 overflow-hidden">
         <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500 mb-1">Python Programming Fundamentals</p>
            <h3 className="font-bold text-gray-900 text-sm truncate" title={lessonData.chapter}>{lessonData.chapter}</h3>
         </div>
         <div className="overflow-y-auto flex-1 p-2">
            {/* Bài hiện tại đang học (Sau này sẽ fetch array danh sách bài học ra đây) */}
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">▶</span>
              <span className="truncate">{lessonData.title}</span>
            </div>
         </div>
      </div>

      {/* 2. CỘT GIỮA: NỘI DUNG BÀI HỌC CHÍNH */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        
        {/* Header Bài học */}
        <div className="p-6 border-b border-gray-100">
           <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
             <span>{lessonData.chapter}</span>
             <span>›</span>
             <span>Lesson {lessonData.id}</span>
           </div>
           <h1 className="text-2xl font-bold text-gray-900 mb-3">{lessonData.title}</h1>
           <div className="flex items-center gap-4 text-xs font-medium">
             <span className="text-gray-500 flex items-center gap-1">⏱ {lessonData.duration} phút</span>
             <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{lessonData.difficulty}</span>
           </div>
        </div>

        {/* Thanh Tabs chuyển đổi nội dung */}
        <div className="flex border-b border-gray-100 px-6 gap-6 bg-gray-50/30">
          {lessonData.hasVideo && (
            <button 
              onClick={() => setActiveTab('video')}
              className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'video' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              <span>🎬</span> Video
            </button>
          )}
          {lessonData.hasSlide && (
            <button 
              onClick={() => setActiveTab('slide')}
              className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'slide' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              <span>📊</span> Slide
            </button>
          )}
          {lessonData.hasArticle && (
            <button 
              onClick={() => setActiveTab('article')}
              className={`py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'article' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              <span>📄</span> Tài liệu
            </button>
          )}
        </div>

        {/* Khu vực hiển thị nội dung theo Tab */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {/* TAB 1: VIDEO */}
          {activeTab === 'video' && lessonData.videoUrl && (
            <div className="w-full aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-sm">
              <video controls className="w-full h-full object-contain" src={lessonData.videoUrl}>
                Trình duyệt của bạn không hỗ trợ thẻ video.
              </video>
            </div>
          )}

          {/* TAB 2: SLIDE */}
          {activeTab === 'slide' && lessonData.slideUrl && (
            <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-gray-200">
               <iframe 
                 src={lessonData.slideUrl} 
                 className="w-full h-full"
                 allowFullScreen
               ></iframe>
            </div>
          )}

          {/* TAB 3: ARTICLE */}
          {activeTab === 'article' && lessonData.articleContent && (
            <div 
              className="prose prose-sm max-w-none prose-blue bg-white p-8 rounded-xl border border-gray-100 shadow-sm"
              dangerouslySetInnerHTML={{ __html: lessonData.articleContent }} 
            />
          )}
        </div>

        {/* Footer Bài học */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white shrink-0">
           <button className="text-sm font-medium text-gray-500 hover:text-gray-900">← Bài trước</button>
           <div className="flex gap-3">
              <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                ‹› Luyện tập topic này
              </button>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                ✓ Đánh dấu hoàn thành
              </button>
           </div>
        </div>

      </div>

      {/* 3. CỘT PHẢI: WIDGET TIẾN ĐỘ & AI RECOMMEND */}
      <div className="w-full lg:w-72 flex flex-col gap-6 shrink-0">
         <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Your Progress</h3>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500">Bài học này</span>
              <span className="font-bold text-blue-600">0%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '0%' }}></div>
            </div>
         </div>

         <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-blue-700 flex items-center gap-2 mb-2 text-sm">
              <span className="bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">★</span> 
              AI Recommended
            </h3>
            <p className="text-xs text-blue-800 leading-relaxed mb-4">Hoàn thành bài học để AI có thể đánh giá năng lực của bạn.</p>
         </div>
      </div>
      
    </div>
  );
}