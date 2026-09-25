"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // State lưu dữ liệu thật từ DB
  const [userName, setUserName] = useState('Instructor');
  const [notificationCount, setNotificationCount] = useState(0);

  // Gọi API lấy thông tin Giảng viên khi load Layout
  useEffect(() => {
    const fetchLayoutData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5000/api/teacher/layout', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result.success && result.data) {
          setUserName(result.data.fullName);
          setNotificationCount(result.data.notificationCount);
        }
      } catch (error) {
        console.error('Không lấy được thông tin layout:', error);
      }
    };

    fetchLayoutData();
  }, [router]);

  // Danh sách các menu điều hướng
  const menuItems = [
    { title: 'Dashboard', path: '/teacher/dashboard', icon: '⊞' },
    { title: 'Course Management', path: '/teacher/courses', icon: '📚' },
    { title: 'Quản lý đăng ký', path: '/teacher/enrollments', icon: '👥' },
    { title: 'Analytics', path: '/teacher/analytics', icon: '📊' },
    { title: 'Profile', path: '/teacher/profile', icon: '👤' },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between shrink-0 z-10">
        <div>
          {/* Logo & Toggle */}
          <div className="pt-5 pb-4 flex flex-col justify-center px-6 border-b border-gray-50 gap-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3 shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight">PyLearn AI</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-3 mt-4 flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              
              return (
                <Link 
                  key={item.path}
                  href={item.path} 
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    isActive 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={`text-lg ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                    {item.icon}
                  </span> 
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions & Profile */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex flex-col gap-2 mb-4">
             <Link href="/teacher/notifications" className="flex items-center justify-between text-gray-500 text-sm font-medium hover:text-gray-900 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3"><span className="text-gray-400 text-lg">🔔</span> Notifications</div>
                {notificationCount > 0 && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {notificationCount}
                  </span>
                )}
             </Link>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 px-2">
            <div className="w-9 h-9 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center text-sm uppercase shrink-0 shadow-sm">
              {/* Lấy chữ cái đầu tiên của Tên thật để làm Avatar */}
              {userName.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{userName}</p>
              <p className="text-[11px] text-gray-500 font-medium">Instructor</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="relative w-96">
            <span className="absolute left-3 top-2 text-gray-400 text-sm">🔍</span>
            <input 
              type="text" 
              placeholder="Search lessons, topics..." 
              className="w-full bg-gray-50 border border-gray-100 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600 relative p-1 transition-colors text-xl">
              🔔
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              )}
            </button>
            <div className="w-9 h-9 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center text-sm uppercase shadow-sm cursor-pointer hover:bg-blue-700 transition-colors">
              {userName.charAt(0)}
            </div>
          </div>
        </header>

        {/* DYNAMIC CONTENT (Trang Dashboard sẽ được nhúng vào đây) */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
          {children}
        </div>

      </main>
    </div>
  );
}