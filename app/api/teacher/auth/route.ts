import { NextResponse } from 'next/server';
import { TEACHER_COOKIE_NAME, createTeacherSessionToken } from '@/lib/teacher-auth';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { pin } = body;

        const expectedPin = process.env.TEACHER_DASHBOARD_PIN;

        if (!expectedPin) {
            console.error('[TeacherAuth] TEACHER_DASHBOARD_PIN environment variable is not configured');
            return NextResponse.json(
                { error: 'Server authentication configuration error' },
                { status: 500 }
            );
        }

        if (!pin || typeof pin !== 'string' || pin !== expectedPin) {
            return NextResponse.json(
                { error: 'Invalid PIN' },
                { status: 401 }
            );
        }

        const maxAgeSeconds = 60 * 60 * 24; // 24 hours
        const token = await createTeacherSessionToken(expectedPin, maxAgeSeconds * 1000);

        const response = NextResponse.json(
            { success: true, message: 'Authentication successful' },
            { status: 200 }
        );

        response.cookies.set(TEACHER_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: maxAgeSeconds,
        });

        return response;
    } catch (err: any) {
        console.error('[TeacherAuth] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
