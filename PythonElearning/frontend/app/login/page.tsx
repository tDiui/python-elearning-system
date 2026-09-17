"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  
  // State quản lý UI chọn vai trò
  const [activeRole, setActiveRole] = useState<'student' | 'teacher' | 'admin'>('student');

  // State lưu dữ liệu nhập vào và trạng thái xử lý
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const roleConfig = {
    student: { label: 'Sinh viên', emailPlaceholder: 'nguyenvanan@student.edu.vn' },
    teacher: { label: 'Giảng viên', emailPlaceholder: 'nguyenthilan@edu.vn' },
    admin: { label: 'Quản trị viên', emailPlaceholder: 'admin@pylearn.edu.vn' }
  };

  // Hàm xử lý khi bấm Đăng nhập
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Gọi API Backend
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Đăng nhập thành công! Đang vào hệ thống...' });
        
        // LƯU TOKEN VÀ THÔNG TIN USER VÀO LOCAL STORAGE
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Chuyển hướng vào trang Dashboard sau 1 giây
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 relative">
      {/* Header Logo */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-md overflow-hidden">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
            <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">PyLearn AI</h1>
        <p className="text-sm text-gray-500 mt-1">Hệ thống E-learning Python với AI cá nhân hóa</p>
      </div>

      {/* Login Card */}
      <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] w-full max-w-md border border-gray-100">
        
        {/* Role Selector */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Demo — Chọn vai trò</p>
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            {(Object.keys(roleConfig) as Array<keyof typeof roleConfig>).map((role) => (
              <button 
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeRole === role ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {roleConfig[role].label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Đăng nhập - Đã bổ sung onSubmit */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          {/* Thông báo lỗi/thành công */}
          {message.text && (
            <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          <Input 
            label="Email" 
            type="email" 
            placeholder={roleConfig[activeRole].emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <div className="flex flex-col gap-2">
            <Input 
              label="Mật khẩu" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Quên mật khẩu?</Link>
            </div>
          </div>

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Đang kiểm tra...' : `Đăng nhập với tư cách ${roleConfig[activeRole].label}`}
          </Button>
        </form>

        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-400">hoặc</span>
          </div>
        </div>

        <Button variant="outline" fullWidth className="gap-2" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.8 15.72 17.58V20.34H19.28C21.36 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
            <path d="M12 23C14.97 23 17.46 22.02 19.28 20.34L15.72 17.58C14.73 18.24 13.48 18.64 12 18.64C9.14 18.64 6.71 16.71 5.84 14.12H2.17V16.97C3.98 20.57 7.7 23 12 23Z" fill="#34A853"/>
            <path d="M5.84 14.12C5.62 13.47 5.49 12.75 5.49 12C5.49 11.25 5.62 10.53 5.84 9.88V7.03H2.17C1.43 8.5 1 10.2 1 12C1 13.8 1.43 15.5 2.17 16.97L5.84 14.12Z" fill="#FBBC05"/>
            <path d="M12 5.36C13.62 5.36 15.07 5.92 16.21 7.01L19.36 3.86C17.45 2.08 14.97 1 12 1C7.7 1 3.98 3.43 2.17 7.03L5.84 9.88C6.71 7.29 9.14 5.36 12 5.36Z" fill="#EA4335"/>
          </svg>
          Đăng nhập với Google
        </Button>

        <p className="text-center text-sm text-gray-600 mt-8">
          Chưa có tài khoản? <Link href="/register" className="text-indigo-600 font-medium hover:underline">Đăng ký ngay</Link>
        </p>
      </div>

      <p className="text-[12px] text-gray-400 mt-8">
        Dữ liệu minh hoạ — Prototype nghiên cứu E-learning Python
      </p>

      <div className="absolute bottom-6 right-6 w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
        ?
      </div>
    </div>
  );
}