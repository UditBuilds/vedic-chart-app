import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function POST(request: Request) {
  try {
    let body = '';
    try {
      body = await request.text();
    } catch {
      body = '';
    }

    const backendRes = await fetch(`${BACKEND_URL}/api/v1/chat/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body,
    });

    let data: any;
    try {
      data = await backendRes.json();
    } catch {
      data = {
        error: {
          type: 'upstream_error',
          message: 'Backend returned invalid JSON response',
        },
      };
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    console.error('Error proxying to chat prompt facts service:', err);
    return NextResponse.json(
      {
        error: {
          type: 'proxy_error',
          message: err.message || 'Failed to reach chat prompt facts service on port 5000',
        },
      },
      { status: 502 }
    );
  }
}
