export const LOAD_STATUSES = [
  'AVAILABLE',
  'BOOKED',
  'CONFIRMED',
  'DISPATCHED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'DOCUMENTS_PENDING',
  'READY_FOR_INVOICE',
  'INVOICED',
  'PAID',
  'CANCELLED',
] as const;

export type LoadStatus = (typeof LOAD_STATUSES)[number];

export const LOAD_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  BOOKED: 'Booked',
  CONFIRMED: 'Confirmed',
  DISPATCHED: 'Dispatched',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  DOCUMENTS_PENDING: 'Docs Pending',
  READY_FOR_INVOICE: 'Ready for Invoice',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

export const LOAD_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-blue-100 text-blue-800',
  BOOKED: 'bg-indigo-100 text-indigo-800',
  CONFIRMED: 'bg-purple-100 text-purple-800',
  DISPATCHED: 'bg-cyan-100 text-cyan-800',
  PICKED_UP: 'bg-teal-100 text-teal-800',
  IN_TRANSIT: 'bg-sky-100 text-sky-800',
  DELIVERED: 'bg-green-100 text-green-800',
  DOCUMENTS_PENDING: 'bg-amber-100 text-amber-800',
  READY_FOR_INVOICE: 'bg-orange-100 text-orange-800',
  INVOICED: 'bg-violet-100 text-violet-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['BOOKED', 'CANCELLED'],
  BOOKED: ['CONFIRMED', 'AVAILABLE', 'CANCELLED'],
  CONFIRMED: ['DISPATCHED', 'BOOKED', 'CANCELLED'],
  DISPATCHED: ['PICKED_UP', 'CONFIRMED', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'DISPATCHED'],
  IN_TRANSIT: ['DELIVERED', 'PICKED_UP'],
  DELIVERED: ['DOCUMENTS_PENDING', 'READY_FOR_INVOICE'],
  DOCUMENTS_PENDING: ['READY_FOR_INVOICE', 'DELIVERED'],
  READY_FOR_INVOICE: ['INVOICED'],
  INVOICED: ['PAID'],
  PAID: [],
  CANCELLED: [],
};

export const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DRIVER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
};

export const DRIVER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  ON_LEAVE: 'bg-amber-100 text-amber-800',
  TERMINATED: 'bg-red-100 text-red-800',
};

export const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export const COMPANY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export const MC_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type MCStatus = (typeof MC_STATUSES)[number];

export const MC_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export const MC_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export const USER_ROLES = ['ADMIN', 'DISPATCHER', 'COMPANY_OWNER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
  COMPANY_OWNER: 'Company Owner',
};

export const NOTIFICATION_TYPES = ['MISSING_POD', 'OVERDUE_INVOICE', 'EXPIRING_CDL', 'DELIVERED_NOT_INVOICED', 'PAYMENT_RECEIVED'] as const;
