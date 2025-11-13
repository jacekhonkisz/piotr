'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Plus,
  Calendar,
  Key,
  Settings,
  LogOut,
  BarChart3,
  Users,
  Shield
} from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AdminNavbarProps {
  isCondensed?: boolean;
}

export default function AdminNavbar({ isCondensed = false }: AdminNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Determine if we should show context actions (for clients/reports pages)
  const isClientsContext = pathname?.startsWith('/admin') && 
    (pathname === '/admin' || pathname?.includes('/clients') || pathname?.includes('/klienci'));
  const isReportsContext = pathname?.includes('/reports') || pathname?.includes('/raporty');
  const showContextActions = isClientsContext || isReportsContext;

  // Determine active section
  const isReportsActive = pathname?.includes('/reports') || pathname?.includes('/raporty');
  const isClientsActive = pathname === '/admin' || pathname?.includes('/clients') || pathname?.includes('/klienci');
  const isMonitoringActive = pathname?.includes('/monitoring');

  // Get user initials for avatar
  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
    }
    return profile?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <nav className={`bg-white border-b border-[#E9EEF5] shadow-[0_2px_8px_rgba(16,24,40,0.04)] sticky top-0 z-40 transition-all duration-200 ease-out ${
      isCondensed ? 'h-14' : 'h-16'
    }`}>
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full gap-4">
          
          {/* LEFT - Primary Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => router.push('/admin/reports')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isReportsActive
                  ? 'bg-[#EEF4FF] text-[#1F3D8A] shadow-sm'
                  : 'text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F3D8A]'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Raporty</span>
            </button>

            <button
              onClick={() => router.push('/admin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isClientsActive
                  ? 'bg-[#EEF4FF] text-[#1F3D8A] shadow-sm'
                  : 'text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F3D8A]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Klienci</span>
            </button>

            <button
              onClick={() => router.push('/admin/monitoring')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isMonitoringActive
                  ? 'bg-[#EEF4FF] text-[#1F3D8A] shadow-sm'
                  : 'text-[#667085] hover:bg-[#F8FAFC] hover:text-[#1F3D8A]'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Monitoring</span>
            </button>
          </div>

          {/* CENTER - Context Actions */}
          {showContextActions && (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => {
                  // Navigate to add client if on clients page, otherwise show context-appropriate action
                  if (isClientsContext) {
                    // This will be handled by the page itself - we just provide the button
                    const event = new CustomEvent('navbar-add-click');
                    window.dispatchEvent(event);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#1F3D8A] text-white rounded-lg text-sm font-medium hover:bg-[#1A2F6B] transition-all duration-200 shadow-sm hover:shadow-md"
                title="Dodaj"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">Dodaj</span>
              </button>

              <button
                onClick={() => router.push('/admin/calendar')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E9EEF5] text-[#344054] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] hover:border-[#D0D7DE] transition-all duration-200"
                title="Kalendarz"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden lg:inline">Kalendarz</span>
              </button>
            </div>
          )}

          {/* RIGHT - System & Account Actions */}
          <div className="flex items-center gap-2">
            {/* API Tokens */}
            <button
              onClick={() => {
                const event = new CustomEvent('navbar-tokens-click');
                window.dispatchEvent(event);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E9EEF5] text-[#344054] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] hover:border-[#D0D7DE] transition-all duration-200"
              title="API Tokens"
            >
              <Key className="h-4 w-4" />
              <span className="hidden lg:inline">API Tokens</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => router.push('/admin/settings')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E9EEF5] text-[#344054] rounded-lg text-sm font-medium hover:bg-[#F8FAFC] hover:border-[#D0D7DE] transition-all duration-200"
              title="Ustawienia"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden xl:inline">Ustawienia</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E9EEF5] text-[#344054] rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-[#D92D20] transition-all duration-200"
              title="Wyloguj"
            >
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#1F3D8A] to-[#7EA5FF] flex items-center justify-center text-white text-xs font-semibold">
                {getUserInitials()}
              </div>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

