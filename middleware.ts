import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TEACHER_COOKIE_NAME, verifyTeacherSessionToken } from './lib/teacher-auth';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public access to login page and auth endpoint
    if (pathname === '/teacher/login' || pathname === '/api/teacher/auth') {
        return NextResponse.next();
    }

    // Intercept /teacher and /api/teacher routes
    const isTeacherPageRoute = pathname === '/teacher' || pathname.startsWith('/teacher/');
    const isTeacherApiRoute = pathname.startsWith('/api/teacher/');

    if (isTeacherPageRoute || isTeacherApiRoute) {
        const token = req.cookies.get(TEACHER_COOKIE_NAME)?.value;
        const expectedPin = process.env.TEACHER_DASHBOARD_PIN;

        const isValid = await verifyTeacherSessionToken(token, expectedPin);

        if (!isValid) {
            if (isTeacherApiRoute) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            // Redirect page requests to login page
            const loginUrl = new URL('/teacher/login', req.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/teacher/:path*', '/api/teacher/:path*'],
};
