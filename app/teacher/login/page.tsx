'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeacherLoginPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/teacher/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                window.location.href = '/teacher';
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'PIN 번호가 올바르지 않습니다.');
            }
        } catch {
            setError('인증 중 오류가 발생했습니다. 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ width: '100%', maxWidth: '360px', padding: '24px', border: '1px solid #ccc', borderRadius: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>교사 대시보드 로그인</h1>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '12px' }}>
                        <label htmlFor="pin" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem' }}>PIN 번호</label>
                        <input
                            id="pin"
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="PIN 입력"
                            required
                            autoFocus
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                    </div>
                    {error && (
                        <p style={{ color: '#d32f2f', fontSize: '0.875rem', marginBottom: '12px' }}>{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {loading ? '인증 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </main>
    );
}
