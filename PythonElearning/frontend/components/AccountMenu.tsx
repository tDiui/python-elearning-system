"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Pencil, Save, UserRound, X } from 'lucide-react';
import { createPortal } from 'react-dom';

type Account = {
  fullName: string;
  email: string;
  role: string;
  studentId?: string | null;
};

type AccountMenuProps = {
  fullName: string;
  roleLabel: string;
  onProfileUpdated?: (account: Account) => void;
  avatarClassName?: string;
  menuPlacement?: 'bottom-end' | 'top-start';
};

type AccountResponse = {
  success: boolean;
  message?: string;
  data?: Account;
};

const API_ENDPOINT = 'http://localhost:5000/api/auth/profile';

export default function AccountMenu({
  fullName,
  roleLabel,
  onProfileUpdated,
  avatarClassName = 'bg-blue-100 text-blue-600',
  menuPlacement = 'bottom-end',
}: AccountMenuProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const updateMenuPosition = () => {
      const anchor = avatarRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const menuWidth = 256;
      const left = menuPlacement === 'top-start' ? anchor.left : anchor.right - menuWidth;
      const horizontalPosition = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      setMenuStyle(menuPlacement === 'top-start'
        ? {
            left: horizontalPosition,
            bottom: Math.max(8, window.innerHeight - anchor.top + 8),
            position: 'fixed',
          }
        : {
            left: horizontalPosition,
            top: anchor.bottom + 8,
            position: 'fixed',
          });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuPlacement, open]);

  const getToken = () => localStorage.getItem('token');

  const openEditForm = async () => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setOpen(false);
    setEditing(true);
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json() as AccountResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Không thể tải thông tin tài khoản.');
      }
      setAccount(payload.data);
      setForm({ fullName: payload.data.fullName, email: payload.data.email });
    } catch (requestError) {
      console.error('Lỗi tải thông tin tài khoản:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải thông tin tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch(API_ENDPOINT, {
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
      const payload = await response.json() as AccountResponse;
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
      onProfileUpdated?.(payload.data);
      setEditing(false);
    } catch (requestError) {
      console.error('Lỗi cập nhật thông tin tài khoản:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật thông tin tài khoản.');
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('account-logged-out'));
    router.replace('/login');
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={avatarRef}
        type="button"
        aria-label="Mở menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold uppercase shadow-sm transition hover:ring-2 hover:ring-blue-200 ${avatarClassName}`}
      >
        {fullName?.trim().charAt(0) || 'U'}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          className="z-[100] w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-gray-900">{fullName || 'Tài khoản'}</p>
            <p className="mt-0.5 text-xs text-gray-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void openEditForm()}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4 text-gray-400" />
            Chỉnh sửa thông tin
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>,
        document.body
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditing(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-edit-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="account-edit-title" className="font-bold text-gray-900">Thông tin tài khoản</h2>
                  <p className="text-xs text-gray-500">Cập nhật họ tên và email của bạn</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setEditing(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Đang tải thông tin...</p>
            ) : (
              <form onSubmit={saveProfile} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Họ và tên
                  <input
                    required
                    maxLength={100}
                    value={form.fullName}
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                  Email
                  <input
                    required
                    type="email"
                    maxLength={150}
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                {account?.studentId && (
                  <p className="text-xs text-gray-500">
                    Mã sinh viên: <span className="font-medium text-gray-700">{account.studentId}</span>
                  </p>
                )}
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
