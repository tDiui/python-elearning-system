"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TestCase {
  input: string;
  expected: string;
  // Khai báo thêm các trường kết quả trả về từ Backend
  status?: 'Pass' | 'Fail' | 'Error';
  actual?: string;
  passed?: boolean;
}

interface ExerciseDetail {
  id: number;
  title: string;
  topicName: string;
  type: string;
  difficultyLevel: number;
  content: string;
  starterCode: string;
  hints: string | null;
  testCases: TestCase[];
}

export default function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  
  // State quản lý kết quả chạy code
  const [testResults, setTestResults] = useState<TestCase[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const fetchExercise = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/student/exercise?id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          setExercise(data.data);
          
          // LẤY CODE NHÁP TỪ LOCALSTORAGE (NẾU CÓ)
          const savedCode = localStorage.getItem(`draft_code_${id}`);
          if (savedCode) {
            setCode(savedCode); // Nếu có nháp thì đổ nháp vào
          } else {
            setCode(data.data.starterCode || "# Viết code của bạn ở đây\n"); // Không có nháp thì lấy code mẫu từ DB
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExercise();
  }, [id]);

  // HÀM GỌI API CHẠY CODE
  const handleRunCode = async () => {
    if (!exercise || !code.trim()) return;
    setIsRunning(true);
    setTestResults([]); // Reset kết quả cũ

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/student/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code,
          testCases: exercise.testCases
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestResults(data.results); // Lưu kết quả trả về
      } else {
        alert(data.message || "Có lỗi xảy ra khi chấm bài");
      }
    } catch (error) {
      console.error("Lỗi khi gửi code:", error);
      alert("Không thể kết nối đến máy chủ chấm code.");
    } finally {
      setIsRunning(false);
    }
  };

// HÀM XỬ LÝ NỘP BÀI (SUBMIT) VÀ LƯU DATABASE
  const handleSubmit = async () => {
    // 1. Kiểm tra điều kiện nộp bài
    if (testResults.length === 0) {
      alert("Vui lòng bấm 'Run Code' để chạy thử trước khi nộp bài!");
      return;
    }

    const isAllPassed = testResults.every(tc => tc.passed === true);
    
    if (!isAllPassed) {
      alert("Code của bạn chưa vượt qua hết các Test Cases. Vui lòng sửa lại!");
      return;
    }

    // 2. Gửi API lưu xuống Database
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/student/submit-exercise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseId: id, 
          courseId: 1,    // <--- THÊM DÒNG NÀY VÀO (Tạm thời truyền mã khóa học là 1)
          code: code,     
          isPassed: true  
        })
      });

      const data = await res.json();
      
      if (data.success) {
        alert("🎉 Chúc mừng! Code của bạn đã được lưu vào hệ thống.");
        
        // Dọn dẹp bản nháp trong LocalStorage vì bài đã nộp thành công
        localStorage.removeItem(`draft_code_${id}`);
        
        // Chuyển hướng sinh viên về trang Thư viện Bài tập
        router.push('/student/exercises');
      } else {
        alert("Lỗi lưu bài: " + data.message);
      }
    } catch (error) {
      console.error("Lỗi khi gọi API nộp bài:", error);
      alert("Không thể kết nối đến máy chủ.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Đang tải môi trường Code...</div>;
  if (!exercise) return <div className="h-screen flex items-center justify-center">Bài tập không tồn tại!</div>;

  // Quyết định xem sẽ hiển thị Test Case gốc hay Test Case đã có kết quả
  const displayTestCases = testResults.length > 0 ? testResults : exercise.testCases;

  return (
    <div className="flex h-screen bg-white overflow-hidden text-sm">
      
      {/* CỘT TRÁI: ĐỀ BÀI (Giữ nguyên) */}
      <div className="w-[380px] border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100">
          <Link href="/student/exercises" className="text-gray-400 hover:text-blue-600 font-medium mb-4 inline-block transition-colors">
            ← Quay lại thư viện
          </Link>
          <div className="flex gap-2 mb-3">
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">{exercise.type}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
              ${exercise.difficultyLevel === 1 ? 'text-emerald-600 bg-emerald-50' : 
                exercise.difficultyLevel === 2 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
              {exercise.difficultyLevel === 1 ? 'Easy' : exercise.difficultyLevel === 2 ? 'Medium' : 'Hard'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{exercise.title}</h1>
          <p className="text-gray-500 text-xs flex items-center gap-1.5">
            <span className="text-red-500">🎯</span> Topic: {exercise.topicName}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div 
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed
            [&>h3]:text-[15px] [&>h3]:font-bold [&>h3]:text-gray-900 [&>h3]:mb-2 [&>h3]:mt-6 first:[&>h3]:mt-0
            [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ul>li]:mb-1
            [&>code]:bg-blue-50 [&>code]:text-blue-600 [&>code]:px-1 [&>code]:rounded"
            dangerouslySetInnerHTML={{ __html: exercise.content }}
          />
        </div>
      </div>

      {/* CỘT GIỮA: MÔI TRƯỜNG CODE (IDE) */}
      <div className="flex-1 flex flex-col bg-[#0f172a]">
        <div className="h-12 bg-[#1e293b] flex items-center justify-between px-4 shrink-0">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <div className="text-gray-400 text-xs font-mono">solution.py</div>
          <div className="text-gray-500 text-xs">Python 3.11</div>
        </div>

        <div className="flex-1 p-6 relative">
          <textarea 
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              // TỰ ĐỘNG LƯU NHÁP VÀO LOCALSTORAGE
              localStorage.setItem(`draft_code_${id}`, e.target.value);
            }}
            className="w-full h-full bg-transparent text-gray-100 font-mono text-[14px] resize-none outline-none leading-loose spellcheck-false"
            spellCheck="false"
          />
        </div>

        <div className="h-16 bg-white border-t border-gray-200 flex items-center px-6 gap-3 shrink-0">
          <button 
            onClick={handleRunCode}
            disabled={isRunning}
            className={`${isRunning ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} font-bold px-6 py-2.5 rounded-lg text-[13px] flex items-center gap-2 transition-colors`}
          >
            {isRunning ? '⏳ Đang chấm...' : '▶ Run Code'}
          </button>
            <button 
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-2.5 rounded-lg text-[13px] flex items-center gap-2 transition-colors shadow-sm"
          >
            ✓ Submit
          </button>
        </div>
      </div>

      {/* CỘT PHẢI: TEST CASES & KẾT QUẢ */}
      <div className="w-[320px] border-l border-gray-200 bg-gray-50 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="font-bold text-gray-900 mb-4 text-[14px]">Test Cases</h3>
          
          <div className="space-y-3">
            {displayTestCases && displayTestCases.length > 0 ? (
              displayTestCases.map((tc, idx) => {
                // Logic đổi màu giao diện dựa trên kết quả
                const isPass = tc.passed === true;
                const isFail = tc.passed === false && tc.status !== 'Error';
                const isError = tc.status === 'Error';

                let badgeClass = "bg-gray-200 text-gray-500";
                let badgeText = "Chờ";

                if (isPass) { badgeClass = "bg-emerald-100 text-emerald-600"; badgeText = "Pass"; }
                else if (isFail) { badgeClass = "bg-red-100 text-red-600"; badgeText = "Fail"; }
                else if (isError) { badgeClass = "bg-amber-100 text-amber-600"; badgeText = "Error"; }
                else if (isRunning) { badgeClass = "bg-blue-100 text-blue-600"; badgeText = "Running"; }

                let borderClass = "border-gray-200";
                if (isPass) borderClass = "border-emerald-300 shadow-sm";
                if (isFail || isError) borderClass = "border-red-300 shadow-sm";

                return (
                  <div key={idx} className={`bg-white border ${borderClass} rounded-xl p-4 transition-all duration-300`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-900 text-xs">Test {idx + 1}</span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 space-y-1.5">
                      <div><span className="text-gray-400 block mb-0.5 text-[10px]">INPUT</span> <span className="text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{tc.input || 'None'}</span></div>
                      <div><span className="text-gray-400 block mb-0.5 text-[10px]">EXPECTED OUTPUT</span> <span className="text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{tc.expected}</span></div>
                      
                      {/* Chỉ hiện Actual Output khi đã chạy code xong */}
                      {tc.actual !== undefined && (
                        <div className="pt-2 mt-2 border-t border-gray-100">
                          <span className={`${isPass ? 'text-emerald-500' : 'text-red-500'} block mb-0.5 text-[10px] font-bold`}>YOUR OUTPUT</span> 
                          <span className={`px-1.5 py-0.5 rounded whitespace-pre-wrap block ${isPass ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                            {tc.actual || '"" (Trống)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-xs text-gray-400 italic">Chưa có test case mẫu.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}