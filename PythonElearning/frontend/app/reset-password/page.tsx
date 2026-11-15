"use client";

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState('');

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (!token) {
      setMessage('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy gửi yêu cầu mới.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể đặt lại mật khẩu.');
      }
      setCompleted(true);
      setMessage(payload.message || 'Đặt lại mật khẩu thành công.');
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      console.error('Lỗi đặt lại mật khẩu:', requestError);
      setMessage(requestError instanceof Error ? requestError.message : 'Không thể kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_20px_rgb(0,0,0,0.04)]">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
        <p className="mb-6 text-sm text-gray-500">
          Liên kết chỉ dùng một lần và có hiệu lực trong 15 phút. Mật khẩu cần dài từ 6 đến 128 ký tự.
        </p>

        {completed ? (
          <div className="space-y-5">
            <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>
            <Link href="/login" className="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="flex flex-col gap-5">
            <Input
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
            <Button type="submit" fullWidth disabled={loading || !token}>
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </Button>
            {!token && (
              <Link href="/forgot-password" className="text-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Gửi lại yêu cầu khôi phục
              </Link>
            )}
          </form>
        )}
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Đang tải...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
