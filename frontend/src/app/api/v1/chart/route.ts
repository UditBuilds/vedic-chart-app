import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const backendRes = await fetch(`${BACKEND_URL}/api/v1/chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    console.error('Error proxying to Vedic chart calculation engine:', err);
    return NextResponse.json(
      {
        error: {
          type: 'proxy_error',
          message: err.message || 'Failed to reach Vedic calculation engine on port 5000',
        },
      },
      { status: 502 }
    );
  }
}
