import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '10';

    const backendRes = await fetch(
      `${BACKEND_URL}/api/v1/geo/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    console.error('Error proxying to geo search service:', err);
    return NextResponse.json(
      {
        error: {
          type: 'proxy_error',
          message: err.message || 'Failed to reach geo search service on port 5000',
        },
      },
      { status: 502 }
    );
  }
}
