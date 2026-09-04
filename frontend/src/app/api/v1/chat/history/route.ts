import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const targetUrl = userId
      ? `${BACKEND_URL}/api/v1/chat/history?user_id=${encodeURIComponent(userId)}`
      : `${BACKEND_URL}/api/v1/chat/history`;

    const backendRes = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
      },
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
    console.error('Error proxying to chat history service:', err);
    return NextResponse.json(
      {
        error: {
          type: 'proxy_error',
          message: err.message || 'Failed to reach chat history service on port 5000',
        },
      },
      { status: 502 }
    );
  }
}
