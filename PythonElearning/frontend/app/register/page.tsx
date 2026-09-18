"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Dùng để chuyển trang
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  
  // 1. State lưu trữ dữ liệu người dùng nhập
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studentId: '',
    password: '',
    confirmPassword: ''
  });

  // State lưu trạng thái loading và thông báo lỗi/thành công
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 2. Hàm cập nhật dữ liệu khi gõ phím
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 3. Hàm xử lý khi bấm nút "Tạo tài khoản"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trình duyệt tự reload trang

    if (!formData.studentId.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã sinh viên!' });
      return;
    }
    
    // Kiểm tra mật khẩu khớp nhau
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // GỌI API BACKEND NODE.JS
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          studentId: formData.studentId,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Đăng ký thành công! Đang chuyển trang...' });
        // Chờ 1.5 giây để hiện thông báo rồi chuyển về trang Login
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ Backend!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 relative">
      <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] w-full max-w-md border border-gray-100">
        
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-6">
          <span className="mr-1">←</span> Quay lại đăng nhập
        </Link>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tạo tài khoản</h1>
        <p className="text-sm text-gray-500 mb-6">Đăng ký để bắt đầu học Python với AI.</p>

        {/* Hiển thị thông báo (Lỗi màu đỏ, Thành công màu xanh) */}
        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message.text}
          </div>
        )}

        {/* Thêm onSubmit vào form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <Input label="Họ" name="firstName" value={formData.firstName} onChange={handleChange} required />
            <Input label="Tên" name="lastName" value={formData.lastName} onChange={handleChange} required />
          </div>
          
          <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} required />
          <Input label="Mã sinh viên" name="studentId" value={formData.studentId} onChange={handleChange} required />
          <Input label="Mật khẩu" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} />
          <Input label="Xác nhận mật khẩu" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength={6} />

          <div className="mt-2">
            {/* Đổi type thành submit và thêm hiệu ứng Loading */}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </div>

      <div className="absolute bottom-6 right-6 w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
        ?
      </div>
    </div>
  );
}