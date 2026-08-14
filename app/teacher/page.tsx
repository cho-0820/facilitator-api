import React from 'react';

export default function TeacherPage() {
    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ padding: '24px', border: '1px solid #e0e0e0', borderRadius: '8px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>교사 대시보드</h1>
                <p style={{ color: '#555' }}>인증 성공 — 대시보드는 다음 단계에서 구현 예정</p>
            </div>
        </main>
    );
}
