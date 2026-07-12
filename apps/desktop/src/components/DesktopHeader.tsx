import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, Bell, ChevronDown } from 'lucide-react';
import { useLicenseStore } from '../store/licenseStore';

interface DesktopHeaderProps {
  onToggleSidebar: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({ onToggleSidebar }) => {
  const { user, setUser } = useLicenseStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('license-store');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 text-lg">PharmacyPro</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                <User size={14} className="text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name || 'User'}</span>
              <ChevronDown size={16} className="text-gray-600" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Role: <span className="font-medium capitalize">{user?.role}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    License: <span className="font-medium">{user?.license_type}</span>
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
