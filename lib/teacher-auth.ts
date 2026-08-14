export const TEACHER_COOKIE_NAME = 'teacher_session';

const encoder = new TextEncoder();

async function getHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function createTeacherSessionToken(
    pin: string,
    maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<string> {
    const expiresAt = Date.now() + maxAgeMs;
    const payload = `teacher_session:${expiresAt}`;
    const key = await getHmacKey(pin);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signatureHex = bufferToHex(signatureBuffer);

    return `${expiresAt}.${signatureHex}`;
}

export async function verifyTeacherSessionToken(
    token: string | undefined | null,
    pin: string | undefined
): Promise<boolean> {
    if (!token || !pin) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [expiresAtStr, signatureHex] = parts;
    const expiresAt = Number(expiresAtStr);

    if (isNaN(expiresAt) || expiresAt < Date.now()) {
        return false;
    }

    try {
        const payload = `teacher_session:${expiresAt}`;
        const key = await getHmacKey(pin);
        const signatureBytes = new Uint8Array(
            signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
        );

        return await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            encoder.encode(payload)
        );
    } catch {
        return false;
    }
}
