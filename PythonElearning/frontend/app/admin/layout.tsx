"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { BarChart3, BookOpen, LayoutDashboard, Settings, Users } from 'lucide-react';
import AccountMenu from '../../components/AccountMenu';

const adminNavigation = [
  { label: 'Dashboard', href: '/admin/dashboard', available: true, Icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', available: true, Icon: Users },
  { label: 'Courses', href: '/admin/courses', available: true, Icon: BookOpen },
  { label: 'Analytics', href: '/admin/analytics', available: true, Icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', available: true, Icon: Settings }
];

const normalizeRole = (role: string) => role
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const subscribeToAuth = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('account-profile-updated', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('account-profile-updated', callback);
  };
};

const getAuthSnapshot = () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  if (!token || !storedUser) return 'invalid';

  try {
    const user = JSON.parse(storedUser) as { fullName?: string; role?: string };
    const role = normalizeRole(user.role || '');
    if (!['admin', 'quan tri vien'].includes(role)) return 'invalid';
    return `ready:${user.fullName || 'Admin'}`;
  } catch {
    return 'invalid';
  }
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authSnapshot = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => 'loading');
  const isInvalid = authSnapshot === 'invalid';
  const userName = authSnapshot.startsWith('ready:') ? authSnapshot.slice(6) : 'Admin';

  useEffect(() => {
    if (isInvalid) router.replace('/login');
  }, [isInvalid, router]);

  if (authSnapshot === 'loading' || isInvalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-medium text-gray-500">
        Đang xác thực quyền quản trị...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <aside className="z-10 flex w-64 shrink-0 flex-col justify-between border-r border-gray-100 bg-white">
        <div>
          <div className="flex h-16 items-center border-b border-gray-50 px-6">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" />
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">PyLearn AI</span>
          </div>
          <nav aria-label="Admin navigation" className="mt-4 flex flex-col gap-1 px-3">
            {adminNavigation.map((item) => item.available ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.Icon size={18} className="mr-3 inline-block align-middle" />
                {item.label}
              </Link>
            ) : (
              <span key={item.href} aria-disabled="true" className="cursor-not-allowed rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300">
                <item.Icon size={18} className="mr-3 inline-block align-middle" />
                {item.label}
              </span>
            ))}
          </nav>
        </div>
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 border-t border-gray-100 px-2 pt-4">
            <AccountMenu
              fullName={userName}
              roleLabel="Quản trị viên"
              avatarClassName="bg-blue-600 text-white"
              menuPlacement="top-start"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{userName}</p>
              <p className="text-[11px] font-medium text-gray-500">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8">
          <p className="text-sm font-medium text-gray-500">Quản trị hệ thống</p>
          <AccountMenu
            fullName={userName}
            roleLabel="Quản trị viên"
            avatarClassName="bg-sky-500 text-white"
          />
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
