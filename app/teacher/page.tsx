'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';

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

interface ImportRowResult {
    row: number;
    classroom_name: string;
    nickname: string;
    student_code?: string;
    consent_status?: boolean;
    status: 'success' | 'failed';
    reason?: string;
    is_generated?: boolean;
}

interface ImportResponse {
    message: string;
    summary: {
        total: number;
        success: number;
        failed: number;
        generated_count: number;
    };
    results: ImportRowResult[];
    generated_students: Array<{
        classroom_name: string;
        nickname: string;
        student_code: string;
        consent_status: string;
    }>;
}

interface ProjectDetail {
    id: string;
    project_name: string;
    updated_at: string;
    block_summary: Record<string, number>;
    total_blocks: number;
    chat_messages: Array<{
        role?: string;
        type?: string;
        text?: string;
        message?: string;
        timestamp?: string;
        time?: string;
    }>;
    project_data: any;
}

interface StudentDetailResponse {
    consent_status: boolean;
    student?: {
        nickname: string;
        student_code: string;
    };
    projects?: ProjectDetail[];
}

export default function TeacherDashboardPage() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loadingClassrooms, setLoadingClassrooms] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Import State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Detail Modal State
    const [detailStudent, setDetailStudent] = useState<{ id: string; nickname: string; studentCode: string } | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailData, setDetailData] = useState<StudentDetailResponse | null>(null);
    const [selectedProjectIdx, setSelectedProjectIdx] = useState<number>(0);

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

    // 3. Download Excel Template
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                '학급명': '3학년 1반',
                '닉네임': '용감한 사자',
                '학생코드': 'S3-1-06',
                '동의여부': 'Y',
            },
            {
                '학급명': '3학년 1반',
                '닉네임': '지혜로운 부엉이',
                '학생코드': '',
                '동의여부': 'Y',
            },
            {
                '학급명': '5학년 3반',
                '닉네임': '호기심 다람쥐',
                '학생코드': '',
                '동의여부': 'N',
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData, {
            header: ['학급명', '닉네임', '학생코드', '동의여부']
        });

        ws['!cols'] = [
            { wch: 15 },
            { wch: 18 },
            { wch: 16 },
            { wch: 12 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '학생명단양식');
        XLSX.writeFile(wb, '학생명단_등록양식.xlsx');
    };

    // 4. Download Generated Student Codes
    const handleDownloadGeneratedCodes = () => {
        if (!importResult || !importResult.generated_students || importResult.generated_students.length === 0) {
            return;
        }

        const exportData = importResult.generated_students.map(s => ({
            '학급명': s.classroom_name,
            '닉네임': s.nickname,
            '발급된 학생코드': s.student_code,
            '연구동의': s.consent_status,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 18 },
            { wch: 18 },
            { wch: 14 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '발급된학생코드');
        XLSX.writeFile(wb, `자동생성_학생코드목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // 5. Handle Excel Upload
    const handleUploadExcel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            alert('업로드할 엑셀 파일(.xlsx)을 먼저 선택해주세요.');
            return;
        }

        setImporting(true);
        setError(null);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await fetch('/api/teacher/students/import', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || '학생 명단 등록에 실패했습니다.');
            }

            setImportResult(data);

            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            await fetchClassrooms();
            if (selectedClassroomId) {
                await fetchSummary(selectedClassroomId);
            }

        } catch (err: any) {
            setError(err.message || '엑셀 업로드 중 오류 발생');
        } finally {
            setImporting(false);
        }
    };

    // 6. Handle Student Detail Modal
    const handleOpenDetail = async (studentId: string, nickname: string, studentCode: string) => {
        setDetailStudent({ id: studentId, nickname, studentCode });
        setLoadingDetail(true);
        setDetailData(null);
        setSelectedProjectIdx(0);

        try {
            const res = await fetch(`/api/teacher/students/${studentId}/detail`);
            if (!res.ok) {
                throw new Error('학생 상세 정보를 불러오지 못했습니다.');
            }
            const data: StudentDetailResponse = await res.json();
            setDetailData(data);
        } catch (err: any) {
            alert(err.message || '상세 조회 오류');
            setDetailStudent(null);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCloseDetail = () => {
        setDetailStudent(null);
        setDetailData(null);
        setSelectedProjectIdx(0);
    };

    // Download Project JSON
    const handleDownloadProjectJson = (project: ProjectDetail) => {
        if (!project || !project.project_data) return;
        const jsonStr = JSON.stringify(project.project_data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${detailStudent?.studentCode || 'student'}_${project.project_name || 'project'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);
    const activeProject = detailData?.projects && detailData.projects.length > 0
        ? detailData.projects[selectedProjectIdx] || detailData.projects[0]
        : null;

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
                        onClick={() => {
                            fetchClassrooms();
                            if (selectedClassroomId) fetchSummary(selectedClassroomId);
                        }}
                        disabled={loadingSummary || loadingClassrooms}
                        style={{ padding: '8px 16px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                    >
                        {loadingSummary ? '새로고침 중...' : '새로고침'}
                    </button>
                </header>

                {/* Excel Bulk Import Section */}
                <section style={{ backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: '0 0 4px 0' }}>학생 명단 일괄 등록 (엑셀)</h2>
                            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                                엑셀 파일(.xlsx)로 학생 명단을 한 번에 등록합니다. 학생코드를 비워두면 학급 규칙에 따라 자동 생성됩니다.
                            </p>
                        </div>
                        <button
                            id="btn-download-template"
                            type="button"
                            onClick={handleDownloadTemplate}
                            style={{
                                padding: '8px 14px',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            📥 학생 명단 양식 다운로드 (.xlsx)
                        </button>
                    </div>

                    <form onSubmit={handleUploadExcel} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            id="file-upload-input"
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            disabled={importing}
                            style={{ fontSize: '0.875rem', padding: '6px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}
                        />
                        <button
                            id="btn-upload-excel"
                            type="submit"
                            disabled={importing || !selectedFile}
                            style={{
                                padding: '8px 18px',
                                backgroundColor: importing || !selectedFile ? '#9ca3af' : '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: importing || !selectedFile ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {importing ? '등록 처리 중...' : '명단 일괄 등록'}
                        </button>
                        {selectedFile && (
                            <span style={{ fontSize: '0.8125rem', color: '#4b5563' }}>선택된 파일: <strong>{selectedFile.name}</strong></span>
                        )}
                    </form>

                    {/* Import Results Table */}
                    {importResult && (
                        <div id="import-result-container" style={{ marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div>
                                    <strong style={{ fontSize: '0.9375rem', color: '#111827' }}>등록 결과: </strong>
                                    <span style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: 600, marginRight: '8px' }}>성공 {importResult.summary.success}명</span>
                                    {importResult.summary.failed > 0 && (
                                        <span style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: 600 }}>실패 {importResult.summary.failed}명</span>
                                    )}
                                </div>
                                {importResult.generated_students && importResult.generated_students.length > 0 && (
                                    <button
                                        id="btn-download-generated"
                                        type="button"
                                        onClick={handleDownloadGeneratedCodes}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                            borderRadius: '6px',
                                            fontSize: '0.8125rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📋 자동생성된 학생코드 목록 다운로드 ({importResult.generated_students.length}명)
                                    </button>
                                )}
                            </div>

                            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th style={{ padding: '8px 12px' }}>행</th>
                                            <th style={{ padding: '8px 12px' }}>학급</th>
                                            <th style={{ padding: '8px 12px' }}>닉네임</th>
                                            <th style={{ padding: '8px 12px' }}>학생코드</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>상태</th>
                                            <th style={{ padding: '8px 12px' }}>비고 / 사유</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importResult.results.map((r, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: r.status === 'success' ? '#ffffff' : '#fef2f2' }}>
                                                <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r.row}</td>
                                                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.classroom_name || '-'}</td>
                                                <td style={{ padding: '8px 12px' }}>{r.nickname || '-'}</td>
                                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                                                    {r.student_code || '-'}
                                                    {r.is_generated && (
                                                        <span style={{ marginLeft: '6px', fontSize: '0.6875rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 4px', borderRadius: '3px' }}>
                                                            자동생성
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                    {r.status === 'success' ? (
                                                        <span style={{ color: '#15803d', fontWeight: 600 }}>성공</span>
                                                    ) : (
                                                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>실패</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 12px', color: r.status === 'success' ? '#6b7280' : '#b91c1c' }}>
                                                    {r.reason || '정상 등록 완료'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

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
                                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>작품 & 대화</th>
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

                                                {/* Detail Action */}
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    {isConsented ? (
                                                        <button
                                                            id={`btn-detail-${student.student_code}`}
                                                            type="button"
                                                            onClick={() => handleOpenDetail(student.id, student.nickname, student.student_code)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                backgroundColor: '#2563eb',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            상세보기
                                                        </button>
                                                    ) : (
                                                        <button
                                                            id={`btn-detail-disabled-${student.student_code}`}
                                                            disabled
                                                            style={{
                                                                padding: '6px 12px',
                                                                backgroundColor: '#e5e7eb',
                                                                color: '#9ca3af',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8125rem',
                                                                cursor: 'not-allowed',
                                                            }}
                                                        >
                                                            비공개
                                                        </button>
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

            {/* Student Detail Modal */}
            {detailStudent && (
                <div
                    id="student-detail-modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                >
                    <div
                        id="student-detail-modal"
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '10px',
                            width: '100%',
                            maxWidth: '900px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                                    학생 상세: {detailStudent.nickname} <span style={{ fontSize: '0.9375rem', color: '#6b7280', fontWeight: 'normal' }}>({detailStudent.studentCode})</span>
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                                    저장된 작품(블록 요약) 및 AI 코드 도우미 대화 이력
                                </p>
                            </div>
                            <button
                                id="btn-close-detail-modal"
                                onClick={handleCloseDetail}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    lineHeight: 1,
                                    padding: '4px 8px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                            {loadingDetail ? (
                                <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                                    학생 작품 및 대화 데이터를 불러오는 중입니다...
                                </div>
                            ) : !detailData?.consent_status ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                                    연구 동의가 미완료(미동의)되어 상세 데이터를 열람할 수 없습니다.
                                </div>
                            ) : !detailData?.projects || detailData.projects.length === 0 ? (
                                <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                                    저장된 작품(프로젝트)이 없습니다.
                                </div>
                            ) : (
                                <div>
                                    {/* Project Selector (if multiple) */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>작품 선택:</label>
                                            <select
                                                id="select-detail-project"
                                                value={selectedProjectIdx}
                                                onChange={(e) => setSelectedProjectIdx(Number(e.target.value))}
                                                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                                            >
                                                {detailData.projects.map((p, idx) => (
                                                    <option key={p.id || idx} value={idx}>
                                                        {p.project_name} ({new Date(p.updated_at).toLocaleString()}) - 블록 {p.total_blocks}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {activeProject && (
                                            <button
                                                id="btn-download-project-json"
                                                type="button"
                                                onClick={() => handleDownloadProjectJson(activeProject)}
                                                style={{
                                                    padding: '6px 12px',
                                                    backgroundColor: '#f3f4f6',
                                                    color: '#374151',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                📥 프로젝트 원문 다운로드 (.json)
                                            </button>
                                        )}
                                    </div>

                                    {activeProject && (
                                        <div>
                                            {/* Section 1: Block Summary */}
                                            <div style={{ marginBottom: '24px', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937' }}>
                                                        🧩 블록 구성 요약
                                                    </h4>
                                                    <span style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 600 }}>
                                                        총 블록 수: {activeProject.total_blocks}개
                                                    </span>
                                                </div>

                                                {Object.keys(activeProject.block_summary || {}).length === 0 ? (
                                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>사용한 블록이 없습니다.</p>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                                                        {Object.entries(activeProject.block_summary).map(([blockType, count]) => (
                                                            <div
                                                                key={blockType}
                                                                style={{
                                                                    backgroundColor: '#ffffff',
                                                                    padding: '8px 12px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #e5e7eb',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    fontSize: '0.8125rem'
                                                                }}
                                                            >
                                                                <code style={{ color: '#1e40af', fontWeight: 500 }}>{blockType}</code>
                                                                <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                                    {count}개
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Section 2: AI Chat Conversation Logs */}
                                            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937' }}>
                                                    💬 AI 코드 도우미 대화 이력 ({activeProject.chat_messages?.length || 0}건)
                                                </h4>

                                                {!activeProject.chat_messages || activeProject.chat_messages.length === 0 ? (
                                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
                                                        해당 프로젝트에 기록된 AI 대화 이력이 없습니다.
                                                    </p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                                                        {activeProject.chat_messages.map((msg: any, idx: number) => {
                                                            const isUser = msg.type === 'user' || msg.role === 'user' || msg.sender === 'user';
                                                            const text = msg.text || msg.message || msg.content || (typeof msg === 'string' ? msg : JSON.stringify(msg));
                                                            const time = msg.time || msg.timestamp || '';

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: isUser ? 'flex-end' : 'flex-start',
                                                                    }}
                                                                >
                                                                    <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '2px', padding: '0 4px' }}>
                                                                        {isUser ? `학생 (${detailStudent.nickname})` : 'AI 코드 도우미'} {time && `· ${time}`}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            maxWidth: '85%',
                                                                            padding: '10px 14px',
                                                                            borderRadius: '8px',
                                                                            backgroundColor: isUser ? '#2563eb' : '#ffffff',
                                                                            color: isUser ? '#ffffff' : '#1f2937',
                                                                            border: isUser ? 'none' : '1px solid #e5e7eb',
                                                                            fontSize: '0.8125rem',
                                                                            lineHeight: 1.5,
                                                                            whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word',
                                                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                                                        }}
                                                                    >
                                                                        {text}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f9fafb' }}>
                            <button
                                type="button"
                                onClick={handleCloseDetail}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
