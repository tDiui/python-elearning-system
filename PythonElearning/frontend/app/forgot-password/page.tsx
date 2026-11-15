"use client";

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gửi yêu cầu khôi phục mật khẩu.');
      }
      setMessage({ type: 'success', text: payload.message });
    } catch (requestError) {
      console.error('Lỗi gửi yêu cầu khôi phục mật khẩu:', requestError);
      setMessage({
        type: 'error',
        text: requestError instanceof Error ? requestError.message : 'Không thể kết nối máy chủ.',
      });
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

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Quên mật khẩu?</h1>
        <p className="text-sm text-gray-500 mb-8">
          Nhập email tài khoản của bạn. Nếu email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu có hiệu lực trong 15 phút.
        </p>

        <form onSubmit={submitRequest} className="flex flex-col gap-5">
          <Input
            label="Email của bạn"
            type="email"
            autoComplete="email"
            maxLength={150}
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {message && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
            >
              {message.text}
            </p>
          )}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
          </Button>
        </form>
      </div>

      <div className="absolute bottom-6 right-6 w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
        ?
      </div>
    </div>
  );
}
