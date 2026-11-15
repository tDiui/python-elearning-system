"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

const emptyForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
type ApiResponse = { success: boolean; message?: string };

export default function TeacherSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setNotice('');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('http://localhost:5000/api/auth/password', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể đổi mật khẩu.');
      }

      setForm(emptyForm);
      setNotice(payload.message || 'Đã đổi mật khẩu thành công.');
    } catch (saveError) {
      console.error('Lỗi đổi mật khẩu giảng viên:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể đổi mật khẩu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Giảng viên · Settings</p>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt tài khoản</h1>
        <p className="mt-1 text-sm text-gray-500">Quản lý mật khẩu bằng chức năng tài khoản hiện có.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={changePassword} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <KeyRound size={19} />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Đổi mật khẩu</h2>
            <p className="mt-1 text-xs text-gray-500">Mật khẩu mới cần có từ 6 đến 128 ký tự.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Mật khẩu hiện tại
            <input
              required
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Mật khẩu mới
            <input
              required
              type="password"
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Xác nhận mật khẩu mới
            <input
              required
              type="password"
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}
