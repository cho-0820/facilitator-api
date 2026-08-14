'use client';

import React, { useEffect, useState } from 'react';

interface Classroom {
    id: string;
    name: string;
    teacher_name: string;
    created_at: string;
    student_count: number;
}

interface StudentSummary {
    id: string;
    student_code: string;
    nickname: string;
    consent_status: boolean;
    status_label: string;
    phase_counts: {
        planning: number;
        monitoring: number;
        modification: number;
    } | null;
    trigger_counts: {
        modeling: number;
        scaffolding: number;
        coaching: number;
        clarification: number;
        reflection: number;
        exploration: number;
    } | null;
    repeated_errors: Array<{ message: string; count: number }> | null;
    total_events: number;
}

export default function TeacherDashboardPage() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loadingClassrooms, setLoadingClassrooms] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch classrooms list on mount
    const fetchClassrooms = async () => {
        setLoadingClassrooms(true);
        setError(null);
        try {
            const res = await fetch('/api/teacher/classrooms');
            if (!res.ok) {
                throw new Error('학급 목록을 불러오지 못했습니다.');
            }
            const data = await res.json();
            const list: Classroom[] = data.classrooms || [];
            setClassrooms(list);
            if (list.length > 0 && !selectedClassroomId) {
                setSelectedClassroomId(list[0].id);
            }
        } catch (err: any) {
            setError(err.message || '학급 로딩 실패');
        } finally {
            setLoadingClassrooms(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
    }, []);

    // 2. Fetch classroom summary when selectedClassroomId changes
    const fetchSummary = async (classroomId: string) => {
        if (!classroomId) return;
        setLoadingSummary(true);
        setError(null);
        try {
            const res = await fetch(`/api/teacher/classrooms/${classroomId}/summary`);
            if (!res.ok) {
                throw new Error('학급 통계 요약을 불러오지 못했습니다.');
            }
            const data = await res.json();
            setStudents(data.students || []);
        } catch (err: any) {
            setError(err.message || '통계 로딩 실패');
        } finally {
            setLoadingSummary(false);
        }
    };

    useEffect(() => {
        if (selectedClassroomId) {
            fetchSummary(selectedClassroomId);
        }
    }, [selectedClassroomId]);

    const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '32px 24px', fontFamily: 'sans-serif', color: '#111827' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>AI 퍼실리테이터 교사 대시보드</h1>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>학생별 AI 개입 트리거 및 반복 오류 패턴 모니터링</p>
                    </div>
                    <button
                        onClick={() => selectedClassroomId && fetchSummary(selectedClassroomId)}
                        disabled={loadingSummary}
                        style={{ padding: '8px 16px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                        {loadingSummary ? '새로고침 중...' : '새로고침'}
                    </button>
                </header>

                {/* Classroom Selector */}
                <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label htmlFor="classroom-select" style={{ fontWeight: 600, fontSize: '0.875rem' }}>학급 선택:</label>
                    {loadingClassrooms ? (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>학급 목록 로딩 중...</span>
                    ) : classrooms.length === 0 ? (
                        <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>등록된 학급이 없습니다.</span>
                    ) : (
                        <select
                            id="classroom-select"
                            value={selectedClassroomId}
                            onChange={(e) => setSelectedClassroomId(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem', minWidth: '240px' }}
                        >
                            {classrooms.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.teacher_name} 선생님) - 학생 {c.student_count}명
                                </option>
                            ))}
                        </select>
                    )}

                    {selectedClassroom && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#6b7280' }}>
                            학급 ID: <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{selectedClassroom.id}</code>
                        </span>
                    )}
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', marginBottom: '24px', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                {/* Statistics Table */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>학생별 개입 및 오류 분석표</h2>
                        <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>총 {students.length}명</span>
                    </div>

                    {loadingSummary ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                            통계 데이터를 집계하는 중입니다...
                        </div>
                    ) : students.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                            선택된 학급에 학생이 등록되어 있지 않습니다.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>학생 (코드 / 닉네임)</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>연구 동의</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>국면별 개입 합계<br /><span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#6b7280' }}>계획 / 점검 / 수정</span></th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>트리거 전략별 개입<br /><span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#6b7280' }}>모델링 · 스캐폴딩 · 코칭 · 명료화 · 성찰 · 탐색</span></th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>반복 오류 패턴 (≥2회)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student) => {
                                        const isConsented = student.consent_status;

                                        return (
                                            <tr
                                                key={student.id}
                                                style={{
                                                    borderBottom: '1px solid #e5e7eb',
                                                    backgroundColor: isConsented ? '#ffffff' : '#f3f4f6',
                                                    color: isConsented ? '#111827' : '#9ca3af',
                                                }}
                                            >
                                                {/* Student Code & Nickname */}
                                                <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                                                    <div>{student.nickname}</div>
                                                    <div style={{ fontSize: '0.75rem', color: isConsented ? '#6b7280' : '#9ca3af' }}>{student.student_code}</div>
                                                </td>

                                                {/* Consent Badge */}
                                                <td style={{ padding: '14px 16px' }}>
                                                    {isConsented ? (
                                                        <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            동의
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#e5e7eb', color: '#4b5563', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            미동의
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Phase Counts */}
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    {isConsented && student.phase_counts ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                            <span title="계획 국면 (모델링+스캐폴딩)" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                계획 {student.phase_counts.planning}
                                                            </span>
                                                            <span title="점검 국면 (코칭+명료화)" style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                점검 {student.phase_counts.monitoring}
                                                            </span>
                                                            <span title="수정 국면 (성찰+탐색)" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                수정 {student.phase_counts.modification}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', fontSize: '0.8125rem' }}>비공개(미동의)</span>
                                                    )}
                                                </td>

                                                {/* Trigger Counts */}
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    {isConsented && student.trigger_counts ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px', fontSize: '0.75rem' }}>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>모:{student.trigger_counts.modeling}</span>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>스:{student.trigger_counts.scaffolding}</span>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>코:{student.trigger_counts.coaching}</span>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>명:{student.trigger_counts.clarification}</span>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>성:{student.trigger_counts.reflection}</span>
                                                            <span style={{ border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: '4px' }}>탐:{student.trigger_counts.exploration}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', fontSize: '0.8125rem' }}>비공개(미동의)</span>
                                                    )}
                                                </td>

                                                {/* Repeated Errors */}
                                                <td style={{ padding: '14px 16px' }}>
                                                    {isConsented ? (
                                                        student.repeated_errors && student.repeated_errors.length > 0 ? (
                                                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.8125rem', color: '#dc2626' }}>
                                                                {student.repeated_errors.map((err, idx) => (
                                                                    <li key={idx} style={{ marginBottom: '2px' }}>
                                                                        <code>{err.message}</code> ({err.count}회 반복)
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>반복 오류 없음</span>
                                                        )
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', fontSize: '0.8125rem' }}>비공개(미동의)</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
