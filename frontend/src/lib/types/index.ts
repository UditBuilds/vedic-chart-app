export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'member';
  avatarUrl?: string;
  organization?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
}

export interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  user: string;
  timestamp: string;
  type: 'deploy' | 'user' | 'billing' | 'security';
}

export interface DashboardData {
  metrics: DashboardMetric[];
  recentActivity: ActivityEvent[];
  systemHealth: {
    cpuLoad: string;
    memoryUsage: string;
    activeSessions: number;
    latencyMs: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    timestamp: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
