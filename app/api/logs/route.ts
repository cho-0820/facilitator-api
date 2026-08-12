import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const length = Array.isArray(body) ? body.length : 1;
        return NextResponse.json({
            message: "Dummy Logs Response",
            receivedLength: length,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
