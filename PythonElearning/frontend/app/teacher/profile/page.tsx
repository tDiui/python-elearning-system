"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Save } from 'lucide-react';

type Account = {
  fullName: string;
  email: string;
  role: string;
  studentId?: string | null;
};
type ApiResponse = { success: boolean; message?: string; data?: Account };
const apiUrl = 'http://localhost:5000/api/auth/profile';

export default function TeacherProfilePage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json() as ApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Không thể tải thông tin tài khoản.');
        }
        setAccount(payload.data);
        setForm({ fullName: payload.data.fullName, email: payload.data.email });
        setError('');
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error('Lỗi tải hồ sơ giảng viên:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải thông tin tài khoản.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadProfile();
    return () => controller.abort();
  }, [router, refreshKey]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
        }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Không thể cập nhật thông tin tài khoản.');
      }

      setAccount(payload.data);
      setForm({ fullName: payload.data.fullName, email: payload.data.email });
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser) as Record<string, unknown>;
          localStorage.setItem('user', JSON.stringify({
            ...user,
            fullName: payload.data.fullName,
            email: payload.data.email,
          }));
        } catch (storageError) {
          console.error('Không thể cập nhật cache tài khoản trong trình duyệt:', storageError);
        }
      }
      window.dispatchEvent(new CustomEvent('account-profile-updated', { detail: payload.data }));
      setNotice(payload.message || 'Đã cập nhật thông tin tài khoản.');
    } catch (saveError) {
      console.error('Lỗi cập nhật hồ sơ giảng viên:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật thông tin tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const refreshProfile = () => {
    setLoading(true);
    setError('');
    setNotice('');
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Giảng viên · Profile</p>
          <h1 className="text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
          <p className="mt-1 text-sm text-gray-500">Cập nhật họ tên và email tài khoản.</p>
        </div>
        <button
          type="button"
          onClick={refreshProfile}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Tải lại
        </button>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading && !account ? (
        <div role="status" className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Đang tải hồ sơ...
        </div>
      ) : account ? (
        <form onSubmit={saveProfile} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-5">
            <label className="block text-sm font-medium text-gray-700">
              Họ và tên
              <input
                required
                maxLength={100}
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                required
                type="email"
                maxLength={150}
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-700">Vai trò</p>
              <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">{account.role}</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Không thể hiển thị hồ sơ. Hãy tải lại trang hoặc đăng nhập lại.
        </div>
      )}
    </div>
  );
}
