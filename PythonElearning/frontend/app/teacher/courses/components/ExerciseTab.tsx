"use client";

import { useState, useEffect } from 'react';

interface TestCase { input: string; expected: string; }
interface Exercise {
  id: number; title: string; chapter: string; difficulty: string;
  timeLimit: number; status: string; content: string;
  starterCode: string; hints: string[]; testCases: TestCase[];
}

// Thêm các Props để nhận bộ lọc và gửi thống kê ra ngoài
interface ExerciseStats { easy: number; medium: number; hard: number; published: number; draft: number; }
interface ExerciseTabProps {
  onAddExercise: () => void;
  filterDifficulty: 'All' | 'Easy' | 'Medium' | 'Hard';
  setFilterDifficulty: (val: 'All' | 'Easy' | 'Medium' | 'Hard') => void;
  filterStatus: 'All' | 'Published' | 'Draft';
  setFilterStatus: (val: 'All' | 'Published' | 'Draft') => void;
  onStatsChange: (stats: ExerciseStats) => void;
}

export default function ExerciseTab({ 
  onAddExercise, filterDifficulty, setFilterDifficulty, 
  filterStatus, setFilterStatus, onStatsChange 
}: ExerciseTabProps) {
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  const fetchExercises = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/teacher/exercises', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setExercises(data.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // Hàm xử lý xóa Bài tập
  const handleDeleteExercise = async (id: number, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài tập "${title}" không?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/teacher/exercise/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        setExercises(prev => prev.filter(ex => ex.id !== id));
      } else {
        alert(data.message || "Lỗi khi xóa!");
      }
    } catch (err) { console.error(err); }
  };
  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchExercises(); 
  }, []);

  // Gửi thống kê đếm số lượng ra ngoài page.tsx mỗi khi dữ liệu thay đổi
  useEffect(() => {
    onStatsChange({
      easy: exercises.filter(e => e.difficulty === 'Easy').length,
      medium: exercises.filter(e => e.difficulty === 'Medium').length,
      hard: exercises.filter(e => e.difficulty === 'Hard').length,
      published: exercises.filter(e => e.status === 'Published').length,
      draft: exercises.filter(e => e.status === 'Draft').length,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  const handleUpdateField = async (field: keyof Exercise, value: string | number | TestCase[]) => {
    if (!activeExercise) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/api/teacher/exercise/${activeExercise.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value })
      });
      setActiveExercise({ ...activeExercise, [field]: value } as Exercise);
      fetchExercises();
    } catch (error) { console.error('Lỗi cập nhật', error); }
  };

  const handleUpdateTestCase = (index: number, key: 'input' | 'expected', value: string) => {
    if (!activeExercise || !activeExercise.testCases) return;
    const newTestCases = [...activeExercise.testCases];
    newTestCases[index][key] = value;
    handleUpdateField('testCases', newTestCases);
  };

  if (loading) return <div className="text-center py-10">Đang tải...</div>;

  const filteredExercises = exercises.filter(ex => {
    const matchDifficulty = filterDifficulty === 'All' || ex.difficulty === filterDifficulty;
    const matchStatus = filterStatus === 'All' || ex.status === filterStatus;
    return matchDifficulty && matchStatus;
  });

  const publishedCount = exercises.filter(ex => ex.status === 'Published').length;

  if (!activeExercise) {
    return (
      <div className="max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Bài tập</h1>
            <p className="text-sm text-gray-500">{exercises.length} bài tập • {publishedCount} đã publish</p>
          </div>
          <button onClick={onAddExercise} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm">
            + Tạo bài tập mới
          </button>
        </div>
        
        <div className="flex items-center gap-6 mb-6">
          <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map(diff => (
              <button key={diff} onClick={() => setFilterDifficulty(diff)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterDifficulty === diff ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {diff === 'All' ? 'Tất cả' : diff}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
             {(['All', 'Published', 'Draft'] as const).map(status => (
              <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterStatus === status ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {status === 'All' ? 'Tất cả' : status}
              </button>
            ))}
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center text-gray-400">Chưa có bài tập nào.</div>
        ) : filteredExercises.length === 0 ? (
          <div className="border border-gray-200 rounded-xl p-10 flex flex-col items-center bg-gray-50 text-gray-500 text-sm">Không tìm thấy bài tập nào phù hợp với bộ lọc.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-400 text-[11px] font-bold uppercase border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Bài tập</th>
                  <th className="px-6 py-4">Chapter</th>
                  <th className="px-6 py-4">Độ khó</th>
                  <th className="px-6 py-4">Test Cases</th>
                  <th className="px-6 py-4">Thời gian</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExercises.map(ex => (
                  <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{ex.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ex.chapter.replace('Chapter ', 'Ch ')}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{ex.chapter.replace('Chapter ', 'Ch ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${ex.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : ex.difficulty === 'Medium' ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-600'}`}>
                        {ex.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4">{ex.testCases?.length || 0}</td>
                    <td className="px-6 py-4">⏱ {ex.timeLimit}p</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[11px] font-semibold ${ex.status === 'Published' ? 'text-emerald-600 bg-emerald-50' : 'text-orange-500 bg-orange-50'}`}>
                        {ex.status === 'Published' ? '✓ Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* Thay thế nút Sửa cũ bằng đoạn này */}
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveExercise(ex)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Sửa ›</button>
                        <button onClick={() => handleDeleteExercise(ex.id, ex.title)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveExercise(null)} className="text-gray-400 hover:text-gray-900 text-xl font-bold">←</button>
          <h1 className="text-3xl font-bold text-gray-900">{activeExercise.title}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleUpdateField('status', activeExercise.status === 'Published' ? 'Draft' : 'Published')} className={`px-5 py-2 text-white rounded-lg text-sm font-semibold ${activeExercise.status === 'Published' ? 'bg-orange-500' : 'bg-blue-600'}`}>
            {activeExercise.status === 'Published' ? 'Chuyển về Draft' : '✓ Publish'}
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Cài đặt bài tập</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 block mb-1">Độ khó</label>
            <select value={activeExercise.difficulty} onChange={(e) => handleUpdateField('difficulty', e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm">
              <option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 block mb-1">Thời gian (phút)</label>
            <input type="number" value={activeExercise.timeLimit} onChange={(e) => handleUpdateField('timeLimit', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Đề bài</h3>
        <textarea value={activeExercise.content} onChange={(e) => handleUpdateField('content', e.target.value)} className="w-full h-32 border border-gray-300 rounded-lg p-4 text-sm resize-none" placeholder="Nhập đề bài chi tiết..." />
      </div>

      <div className="border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Code mẫu (Starter)</h3>
        <textarea value={activeExercise.starterCode} onChange={(e) => handleUpdateField('starterCode', e.target.value)} className="w-full h-40 border border-gray-800 rounded-lg p-4 text-sm bg-[#0f172a] text-green-400 font-mono" placeholder="def hello_world():\n  pass" />
      </div>

      <div className="border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900">Test Cases ({activeExercise.testCases?.length || 0})</h3>
          <button onClick={() => handleUpdateField('testCases', [...(activeExercise.testCases||[]), {input: '', expected: ''}])} className="text-xs text-blue-600 font-medium">+ Thêm test case</button>
        </div>
        <div className="space-y-3">
          {activeExercise.testCases?.map((tc: TestCase, idx: number) => (
            <div key={idx} className="flex items-center gap-3">
              <input type="text" value={tc.input} onChange={(e) => handleUpdateTestCase(idx, 'input', e.target.value)} placeholder="INPUT (VD: [1,2,3])" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm font-mono" />
              <input type="text" value={tc.expected} onChange={(e) => handleUpdateTestCase(idx, 'expected', e.target.value)} placeholder="EXPECTED OUTPUT" className="flex-1 border border-gray-300 rounded-lg p-2 text-sm font-mono" />
              <button onClick={() => handleUpdateField('testCases', activeExercise.testCases.filter((_: TestCase, i: number) => i !== idx))} className="text-gray-400 hover:text-red-500 font-bold">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}