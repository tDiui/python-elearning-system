import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 relative">
      
      <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] w-full max-w-md border border-gray-100">
        
        {/* Nút quay lại */}
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-6">
          <span className="mr-1">←</span> Quay lại đăng nhập
        </Link>
        
        {/* Tiêu đề */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Quên mật khẩu?</h1>
        <p className="text-sm text-gray-500 mb-8">
          Đừng lo lắng! Hãy nhập email liên kết với tài khoản của bạn, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
        </p>

        {/* Form nhập Email */}
        <form className="flex flex-col gap-6">
          <Input 
            label="Email của bạn" 
            type="email" 
            placeholder="nguyenvanan@student.edu.vn" 
          />

          <Button type="button" fullWidth>
            Gửi yêu cầu khôi phục
          </Button>
        </form>
      </div>

      <div className="absolute bottom-6 right-6 w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
        ?
      </div>
    </div>
  );
}