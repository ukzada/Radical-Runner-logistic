'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Truck, Users, Shield, BarChart3,
  ClipboardList, Bell, Search, Menu, X, LogOut, User, ChevronLeft, ChevronRight,
  UserCircle, Link2, Building2, Settings, UserCog, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useViewStore, type ViewName } from '@/store/view-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { api } from '@/lib/api';
import { getInitials, cn } from '@/lib/utils';
import { LoginView } from '@/components/auth/login-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { CompanyListView } from '@/components/companies/company-list-view';
import { CompanyDetailView } from '@/components/companies/company-detail-view';
import { OwnerListView } from '@/components/owners/owner-list-view';
import { OwnerDetailView } from '@/components/owners/owner-detail-view';
import { DispatcherListView } from '@/components/dispatchers/dispatcher-list-view';
import { DispatcherDetailView } from '@/components/dispatchers/dispatcher-detail-view';
import { DriverListView } from '@/components/drivers/driver-list-view';
import { DriverDetailView } from '@/components/drivers/driver-detail-view';
import { DriverAssignView } from '@/components/drivers/driver-assign-view';
import { LoadListView } from '@/components/loads/load-list-view';
import { LoadDetailView } from '@/components/loads/load-detail-view';
import { UserListView } from '@/components/users/user-list-view';
import { SettingsView } from '@/components/settings/settings-view';
import { ReportView } from '@/components/reports/report-view';
import { AuditLogView } from '@/components/audit/audit-log-view';
import { NotificationListView } from '@/components/notifications/notification-list-view';
import { OwnerPortal } from '@/components/owner/owner-portal';
import { OwnerTruckDetail } from '@/components/owner/owner-truck-detail';
import { useNotificationAlarm } from '@/hooks/use-notification-alarm';

interface NavItem {
  label: string;
  view: ViewName;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminNavSections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
      { label: 'Loads', view: 'loads', icon: Truck },
    ],
  },
  {
    title: 'ORGANIZATION',
    items: [
      { label: 'Companies', view: 'companies', icon: Building2 },
      { label: 'Owners', view: 'owners', icon: Crown },
      { label: 'Drivers', view: 'drivers', icon: Users },
    ],
  },
  {
    title: 'TEAM',
    items: [
      { label: 'Dispatchers', view: 'dispatchers', icon: UserCircle },
      { label: 'Users', view: 'users', icon: UserCog },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { label: 'Audit Logs', view: 'audit-logs', icon: ClipboardList },
    ],
  },
];

const dispatcherNavSections: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
      { label: 'Loads', view: 'loads', icon: Truck },
    ],
  },
  {
    title: 'MY TEAM',
    items: [
      { label: 'My Drivers', view: 'drivers', icon: Users },
    ],
  },
];

const viewTitles: Record<ViewName, string> = {
  dashboard: 'Dashboard',
  companies: 'Companies',
  'company-detail': 'Company Details',
  owners: 'Company Owners',
  'owner-detail': 'Owner Details',
  dispatchers: 'Dispatchers',
  'dispatcher-detail': 'Dispatcher Details',
  drivers: 'Drivers',
  'driver-detail': 'Driver Details',
  'driver-assign': 'Assign Drivers',
  loads: 'Loads',
  'load-detail': 'Load Details',
  users: 'User Management',
  settings: 'Settings',
  reports: 'Reports',
  notifications: 'Notifications',
  'audit-logs': 'Audit Logs',
  'owner-portal': 'Fleet Owner Portal',
  'owner-truck-detail': 'Truck Details',
};

function SearchResults({ query, onClose }: { query: string; onClose: () => void }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { setView } = useViewStore();
  const isValidQuery = query.trim().length > 0;

  const VIEW_MAP: Record<string, ViewName> = {
    Driver: 'driver-detail',
    Load: 'load-detail',
    Dispatcher: 'dispatcher-detail',
    Company: 'company-detail',
  };

  useEffect(() => {
    if (!isValidQuery) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    api.get(`/api/search?q=${encodeURIComponent(query)}`)
      .then((data: any) => {
        if (!cancelled) {
          const raw = data?.results || {};
          const flat: any[] = [
            ...(raw.companies || []).map((c: any) => ({ id: c.id, label: c.name, type: 'Company' })),
            ...(raw.drivers || []).map((d: any) => ({ id: d.id, label: `${d.firstName} ${d.lastName}`, type: 'Driver' })),
            ...(raw.loads || []).map((l: any) => ({ id: l.id, label: l.loadNumber, type: 'Load' })),
          ];
          setResults(flat);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) { setResults([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [query, isValidQuery]);

  if (!isValidQuery) return null;

  const handleClick = (r: any) => {
    const view = VIEW_MAP[r.type];
    if (view) setView(view, { id: r.id });
    onClose();
  };

  return (
    <div className='absolute top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg z-50 max-h-64 overflow-y-auto'>
      {loading && <div className='p-3 text-sm text-muted-foreground'>Searching...</div>}
      {!loading && !results.length && <div className='p-3 text-sm text-muted-foreground'>No results found</div>}
      {results.map((r: any) => (
        <button
          key={`${r.type}-${r.id}`}
          className='w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between transition-colors'
          onClick={() => handleClick(r)}
        >
          <span>{r.label}</span>
          <span className='text-xs text-muted-foreground'>{r.type}</span>
        </button>
      ))}
    </div>
  );
}

export function AppShell() {
  const {
    currentView, viewParams, setView,
    sidebarOpen, setSidebarOpen, toggleSidebar,
    sidebarCollapsed, toggleSidebarCollapsed,
  } = useViewStore();
  const isMobile = useIsMobile();
  // Initial state matches SSR (unauthenticated) - do not read localStorage during render
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    // After mount, check browser-only auth state
    // This runs on the client after initial render, matching SSR initial state
    api.isAuthenticated().then((isAuth) => {
      setAuthenticated(isAuth);
    }).catch(() => setAuthenticated(false));
    api.getUser().then((usr) => {
      setUser(usr);
    }).catch(() => setUser(null));
  }, []);

  const role = user?.role as string | undefined;

  // Delivery-date alarm: polls notifications, beeps + toasts on new unread items.
  // Only meaningful for roles that work inside the admin/dispatcher shell.
  useNotificationAlarm({
    enabled: !!authenticated && (role === 'ADMIN' || role === 'DISPATCHER'),
    onUnreadCount: setNotifCount,
  });

  // ... rest of the component unchanged
  const handleLogout = useCallback(() => {
    api.clearTokens();
    setAuthenticated(false);
    setUser(null);
  }, []);

  const handleNavClick = useCallback((view: ViewName) => {
    setView(view);
    setSidebarOpen(false);
  }, [setView, setSidebarOpen]);

  const handleProfileUpdate = useCallback((updatedUser: any) => {
    const merged = { ...(user || {}), ...updatedUser };
    api.setUser(merged);
    setUser(merged);
  }, [user]);

  const handleLoginSuccess = useCallback(() => {
    setAuthenticated(true);
    api.getUser().then((usr) => {
      setUser(usr);
      // Ask for browser notification permission right after login so
      // delivery-date alarms can surface as system notifications
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      // Company owners land directly in their standalone portal
      if (usr?.role === 'COMPANY_OWNER') setView('owner-portal');
    }).catch(() => setUser(null));
  }, [setView]);

  const isAdmin = user?.role === 'ADMIN';
  const navSections = isAdmin ? adminNavSections : dispatcherNavSections;

  if (!authenticated) {
    return <LoginView onSuccess={handleLoginSuccess} />;
  }

  // Company owners bypass the admin/dispatcher shell entirely —
  // they get a dedicated dark fleet portal with its own navigation.
  if (role === 'COMPANY_OWNER') {
    return currentView === 'owner-truck-detail' ? (
      <OwnerTruckDetail />
    ) : (
      <OwnerPortal onLogout={handleLogout} />
    );
  }

  function renderView() {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'companies': return <CompanyListView />;
      case 'company-detail': return <CompanyDetailView />;
      case 'owners': return isAdmin ? <OwnerListView /> : <DashboardView />;
      case 'owner-detail': return isAdmin ? <OwnerDetailView /> : <DashboardView />;
      case 'dispatchers': return <DispatcherListView />;
      case 'dispatcher-detail': return <DispatcherDetailView />;
      case 'drivers': return <DriverListView />;
      case 'driver-detail': return <DriverDetailView />;
      case 'driver-assign': return <DriverAssignView />;
      case 'loads': return <LoadListView />;
      case 'load-detail': return <LoadDetailView />;
      case 'users': return isAdmin ? <UserListView /> : <DashboardView />;
      case 'settings': return <SettingsView onProfileUpdate={handleProfileUpdate} />;
      case 'reports': return <ReportView />;
      case 'audit-logs': return isAdmin ? <AuditLogView /> : <DashboardView />;
      case 'notifications': return <NotificationListView />;
      case 'owner-portal': return <OwnerPortal onLogout={handleLogout} />;
      case 'owner-truck-detail': return <OwnerTruckDetail />;
      default: return <DashboardView />;
    }
  }

  return (
    <div className='flex h-screen overflow-hidden bg-background'>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div className='fixed inset-0 z-40 bg-black/50' onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex h-full flex-col bg-[oklch(0.22_0.04_260)] text-white shrink-0',
          'transition-[width] duration-200 ease-in-out',
          'max-md:fixed max-md:top-0 max-md:left-0 max-md:z-50',
          sidebarCollapsed ? 'w-16' : 'w-64',
          'max-md:w-64',
          isMobile && !sidebarOpen && 'max-md:hidden',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-14 items-center border-b border-white/10 shrink-0',
            sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4',
            'transition-[padding,justify-content] duration-200 ease-in-out',
          )}
        >
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[oklch(0.22_0.04_260)] font-bold text-sm'>RR</div>
          <span
            className={cn(
              'text-lg font-bold tracking-tight whitespace-nowrap overflow-hidden',
              'transition-[opacity,width,margin] duration-200 ease-in-out',
              sidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-0',
            )}
          >
            Radical Runner
          </span>
        </div>

        {/* Navigation */}
        <ScrollArea className='flex-1 py-3'>
          {navSections.map((section) => (
            <div key={section.title} className='mb-4'>
              <p
                className={cn(
                  'px-4 mb-1.5 text-[10px] font-semibold tracking-wider text-white/40 uppercase overflow-hidden whitespace-nowrap',
                  'transition-[opacity,height,margin] duration-200 ease-in-out',
                  sidebarCollapsed ? 'h-0 opacity-0 mb-0 px-2' : 'h-4 opacity-100 mb-1.5',
                )}
              >
                {section.title}
              </p>
              <nav className={cn('space-y-0.5', sidebarCollapsed ? 'px-2' : 'px-2')}>
                {section.items.map((item) => {
                  const isActive = currentView === item.view ||
                    (currentView.endsWith('-detail') && item.view === (currentView.replace('-detail', 's') as ViewName));

                  const navButton = (
                    <button
                      key={item.view}
                      onClick={() => handleNavClick(item.view)}
                      className={cn(
                        'flex w-full items-center rounded-lg text-sm font-medium transition-colors',
                        sidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2',
                        'transition-[padding,gap,justify-content,width] duration-200 ease-in-out',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white',
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className='h-4 w-4 shrink-0' />
                      <span
                        className={cn(
                          'whitespace-nowrap overflow-hidden',
                          'transition-[opacity,width,margin] duration-200 ease-in-out',
                          sidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100',
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );

                  if (sidebarCollapsed && !isMobile) {
                    return (
                      <Tooltip key={item.view}>
                        <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                        <TooltipContent side='right' sideOffset={8}>{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  }

                  return navButton;
                })}
              </nav>
            </div>
          ))}
        </ScrollArea>

        {/* Settings nav item at bottom (both roles) */}
        <div className='shrink-0'>
          <nav className={cn('px-2 pb-1', sidebarCollapsed ? 'flex justify-center' : '')}>
            {(() => {
              const settingsBtn = (
                <button
                  onClick={() => handleNavClick('settings')}
                  className={cn(
                    'flex w-full items-center rounded-lg text-sm font-medium transition-colors',
                    sidebarCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 px-3 py-2',
                    'transition-[padding,gap,justify-content,width] duration-200 ease-in-out',
                    currentView === 'settings'
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                  title={sidebarCollapsed ? 'Settings' : undefined}
                >
                  <Settings className='h-4 w-4 shrink-0' />
                  <span
                    className={cn(
                      'whitespace-nowrap overflow-hidden',
                      'transition-[opacity,width,margin] duration-200 ease-in-out',
                      sidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100',
                    )}
                  >
                    Settings
                  </span>
                </button>
              );

              if (sidebarCollapsed && !isMobile) {
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{settingsBtn}</TooltipTrigger>
                    <TooltipContent side='right' sideOffset={8}>Settings</TooltipContent>
                  </Tooltip>
                );
              }
              return settingsBtn;
            })()}
          </nav>

          {/* User section (hidden when collapsed) */}
          <div
            className={cn(
              'border-t border-white/10 overflow-hidden',
              'transition-[max-height,opacity,padding] duration-200 ease-in-out',
              sidebarCollapsed ? 'max-h-0 opacity-0 border-t-0' : 'max-h-24 opacity-100 p-3',
            )}
          >
            <div className='flex items-center gap-3'>
              <Avatar className='h-8 w-8'>
                <AvatarFallback className='bg-white/20 text-white text-xs'>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium truncate'>{user?.name || 'User'}</p>
                <p className='text-xs text-white/50 truncate'>{user?.role || ''}</p>
              </div>
            </div>
          </div>

          {/* Collapse/Expand button (desktop only) */}
          {!isMobile && (
            <div className={cn(
              'shrink-0 border-t border-white/10',
              sidebarCollapsed ? 'flex justify-center' : 'px-2',
              'transition-[padding] duration-200 ease-in-out',
            )}>
              <button
                onClick={toggleSidebarCollapsed}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                  'text-white/60 hover:text-white hover:bg-white/10',
                  'transition-colors w-full',
                  sidebarCollapsed && 'justify-center px-0 w-10 h-10 mx-auto',
                )}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className='h-4 w-4 shrink-0' /> : <ChevronLeft className='h-4 w-4 shrink-0' />}
                <span className={cn(
                  'whitespace-nowrap overflow-hidden',
                  'transition-[opacity,width] duration-200 ease-in-out',
                  sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                )}>
                  Collapse
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className='flex flex-1 flex-col min-w-0 overflow-hidden'>
        {/* Top Header */}
        <header className='flex h-14 shrink-0 items-center gap-4 border-b bg-card/95 backdrop-blur-sm px-4 sm:px-6 shadow-sm z-10'>
          <Button variant='ghost' size='icon' className='md:hidden' onClick={toggleSidebar}>
            {sidebarOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
          </Button>
          <h2 className='text-lg font-semibold hidden sm:block'>{viewTitles[currentView] || 'Dashboard'}</h2>

          {/* Search */}
          <div className='relative flex-1 max-w-md ml-auto'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search companies, loads, drivers...'
              className='pl-9 h-9'
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearchOpen(false);
                if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
              }}
            />
            {searchOpen && <SearchResults query={searchQuery} onClose={() => setSearchOpen(false)} />}
          </div>

          {/* Notification bell */}
          <Button variant='ghost' size='icon' className='relative' onClick={() => handleNavClick('notifications')}>
            <Bell className='h-5 w-5' />
            {notifCount > 0 && (
              <span className='absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold'>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='gap-2 px-2'>
                <Avatar className='h-7 w-7'>
                  <AvatarFallback className='text-xs bg-primary text-primary-foreground'>{getInitials(user?.name)}</AvatarFallback>
                </Avatar>
                <span className='hidden sm:inline text-sm font-medium'>{user?.name || 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <div className='px-2 py-1.5'>
                <p className='text-sm font-medium'>{user?.name || 'User'}</p>
                <p className='text-xs text-muted-foreground'>{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavClick('settings')}>
                <User className='mr-2 h-4 w-4' /> My Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavClick('settings')}>
                <Settings className='mr-2 h-4 w-4' /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className='text-red-600'>
                <LogOut className='mr-2 h-4 w-4' /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className='flex-1 overflow-y-auto p-4 sm:p-6'>{renderView()}</main>
      </div>
    </div>
  );
}
