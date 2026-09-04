import axios, { AxiosInstance } from 'axios';
import { ChartData, BirthData } from './types/chart.types';

// Always use same-origin relative path in the browser to route through the Next.js proxy,
// preventing client-side cross-origin CORS errors to Flask on port 5000.
const API_BASE_URL = '';

class AstrologyApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  public async getHealth(): Promise<{ status: string; ayanamsa: string }> {
    const res = await this.client.get('/health');
    return res.data;
  }

  public async checkHealth(): Promise<{ status: string; ayanamsa: string }> {
    return this.getHealth();
  }

  public async searchGeoCities(query: string, limit = 10): Promise<Array<{
    name: string;
    country: string;
    region?: string;
    lat: number;
    lon: number;
    tz_offset: number;
    tz_name?: string;
  }>> {
    try {
      const res = await this.client.get<{ results: Array<{
        name: string;
        country: string;
        region?: string;
        lat: number;
        lon: number;
        tz_offset: number;
        tz_name?: string;
      }> }>('/api/v1/geo/search', {
        params: { q: query, limit },
      });
      return res.data?.results || [];
    } catch (err: any) {
      console.warn('Geo search via proxy failed:', err);
      return [];
    }
  }

  public async computeChart(birth: BirthData): Promise<ChartData> {
    try {
      const res = await this.client.post<ChartData>('/api/v1/chart', {
        date: birth.date,
        time: birth.time,
        lat: birth.lat,
        lon: birth.lon,
        tz_offset: birth.tz_offset,
      });
      return res.data;
    } catch (err: any) {
      const backendError = err.response?.data?.error;
      if (backendError) {
        const errorMsg = backendError.message || `Calculation error (${backendError.type})`;
        const enhancedError: any = new Error(errorMsg);
        enhancedError.type = backendError.type;
        enhancedError.status = err.response.status;
        throw enhancedError;
      }
      throw err;
    }
  }

  public async sendChatMessage(birth: BirthData, message: string, userId = 'default_user'): Promise<{ reply: string; raw: any }> {
    const res = await this.client.post('/api/v1/chat', {
      birth: {
        date: birth.date,
        time: birth.time,
        lat: birth.lat,
        lon: birth.lon,
        tz_offset: birth.tz_offset,
      },
      message,
      user_id: userId,
    });
    return {
      reply: res.data.reply || res.data.message || (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)),
      raw: res.data,
    };
  }

  public async getPromptFacts(birth: BirthData, userId = 'default_user'): Promise<{ prompt: string }> {
    const res = await this.client.post('/api/v1/chat/prompt', {
      birth: {
        date: birth.date,
        time: birth.time,
        lat: birth.lat,
        lon: birth.lon,
        tz_offset: birth.tz_offset,
      },
      user_id: userId,
    });
    return res.data;
  }

  public async resetChatHistory(userId = 'default_user'): Promise<any> {
    const res = await this.client.post('/api/v1/chat/reset', {
      user_id: userId,
    });
    return res.data;
  }

  // Dashboard mock helpers
  public async login(credentials: { email: string }) {
    return {
      token: 'mock-jwt-session-token-for-dev',
      user: { id: 'usr_1', email: credentials.email, name: 'Alex Morgan', role: 'admin' },
    };
  }

  public async getDashboardMetrics() {
    return {
      metrics: [
        { id: 'm1', label: 'Calculated Charts', value: '14,290', change: '+24.5%', trend: 'up' as const, description: 'deterministic D1 charts' },
        { id: 'm2', label: 'AI Companion Chats', value: '8,421', change: '+18.1%', trend: 'up' as const, description: 'grounded Groq turns' },
        { id: 'm3', label: 'Ephemeris Precision', value: '100%', change: '0.0%', trend: 'up' as const, description: 'Lahiri Swiss Ephemeris' },
        { id: 'm4', label: 'Average Latency', value: '12ms', change: '-8.3%', trend: 'down' as const, description: 'offline calculation engine' },
      ],
      recentActivity: [
        { id: '1', title: 'Chart Computed (1998 Reference)', description: 'New Delhi, India — D1 Kundli & Vimshottari Dasha', user: 'Primary Profile', timestamp: '2m ago', type: 'deploy' as const },
        { id: '2', title: 'AI Companion Query', description: '"Explain my Moon in Gemini and 10th house transits"', user: 'Alex Morgan', timestamp: '14m ago', type: 'user' as const },
      ],
      systemHealth: { cpuLoad: '8.2%', memoryUsage: '22.1%', activeSessions: 42, latencyMs: 12 },
    };
  }
}

export const astrologyApi = new AstrologyApiClient();
export const api = astrologyApi;
