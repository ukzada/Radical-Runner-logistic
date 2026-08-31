import { create } from 'zustand';

export type ViewName =
  | 'dashboard'
  | 'companies'
  | 'company-detail'
  | 'dispatchers'
  | 'dispatcher-detail'
  | 'drivers'
  | 'driver-detail'
  | 'driver-assign'
  | 'loads'
  | 'load-detail'
  | 'users'
  | 'settings'
  | 'reports'
  | 'notifications'
  | 'audit-logs';

interface ViewState {
  currentView: ViewName;
  viewParams: Record<string, string>;
  /** Controls mobile drawer visibility (true = drawer open on mobile) */
  sidebarOpen: boolean;
  /** Controls desktop sidebar collapsed state (true = icon rail, false = expanded) */
  sidebarCollapsed: boolean;
  setView: (view: ViewName, params?: Record<string, string>) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'dashboard',
  viewParams: {},
  sidebarOpen: false,
  sidebarCollapsed: false,
  setView: (view, params = {}) => set({ currentView: view, viewParams: params }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
