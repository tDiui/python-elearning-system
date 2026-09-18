"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('Student');
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('http://localhost:5000/api/student/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result?.success) {
          if (result?.data?.fullName) {
            setUserName(result.data.fullName);
          }
          if (typeof result?.data?.notificationCount === 'number') {
            setNotificationCount(result.data.notificationCount);
          }
        }
      } catch (error) {
        console.error('Không lấy được thông tin người dùng:', error);
      }
    };

    fetchStudentProfile();
  }, []);

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-gray-50">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">PyLearn AI</span>
          </div>

          {/* Navigation */}
          <nav className="px-3 mt-2 flex flex-col gap-1">
            <Link href="/student/dashboard" className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 text-blue-600 rounded-lg font-medium text-sm">
              <span>⊞</span> Dashboard
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm">
              <span>📚</span> Courses
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm">
              <span>🗺️</span> My Learning Path
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm">
              <span>‹›</span> Exercises
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm">
              <span>📊</span> Results & Analytics
            </Link>
            <Link href="#" className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg font-medium text-sm">
              <span>👤</span> Profile
            </Link>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex flex-col gap-2 mb-4">
             <Link href="#" className="flex items-center justify-between text-gray-500 text-sm font-medium hover:text-gray-900">
                <div className="flex items-center gap-3"><span>🔔</span> Notifications</div>
                {notificationCount > 0 && (
                  <span className="w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
             </Link>
             <Link href="#" className="flex items-center gap-3 text-gray-500 text-sm font-medium hover:text-gray-900 mt-2">
                <span>⚡</span> Take a Quiz
             </Link>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 font-bold rounded-full flex items-center justify-center text-sm">
              {userName?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{userName}</p>
              <p className="text-[11px] text-gray-500">Student</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8">
          <div className="relative w-96">
            <span className="absolute left-3 top-1.5 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search lessons, topics..." 
              className="w-full bg-gray-50 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600">🔔</button>
            <div className="w-8 h-8 bg-blue-100 text-blue-600 font-bold rounded-full flex items-center justify-center text-sm">M</div>
          </div>
        </header>

        {/* DYNAMIC CONTENT (Trang Dashboard sẽ được nhúng vào đây) */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>

      </main>
    </div>
  );
}