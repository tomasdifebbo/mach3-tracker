const GENERIC_FOLDER_SEGMENTS = new Set([
    '',
    'DESCONHECIDO',
    'ROUTER',
    'ROUTER 1',
    'ROUTER 2',
    'ROUTER CENTRAL',
    'LASER RUIDA',
    'LASERCAD',
    'CNC',
    'ISOPOR',
    'COD',
    'GCODE',
    'G-CODE',
    'CORTES',
    'PROGRAMA',
    'FILES',
    'USERS',
    'ATELIER',
    'TOMAS',
    'MACH3',
    'JOBS ATIVOS',
    'DADOS2',
    'DADOS2 - JOBS ATIVOS',
    '3 - OFICINA',
    'OFICINA',
    'ARQUIVO',
    'ARQUIVOS',
    'ARQUIVOS 2024',
    'ARQUIVOS 2025',
    'ARQUIVOS 2026',
    'GERAL'
]);

const GENERIC_SEGMENT_REGEX = /^(?:ARQUIVOS?|ROUTER|CNC|ISOPOR|COD|GCODE|G-CODE|CORTES|MACH3|TOMAS)\s*\d{0,4}$/i;
const FILE_EXT_REGEX = /\.(txt|tap|nc|gcode|cnc|cdr|eps|dxf|crv3d|crv|stl|v3d|ai|pdf)$/i;

function isGenericFolderSegment(segment = '') {
    const up = String(segment || '').toUpperCase().trim();
    if (!up) return true;
    if (GENERIC_FOLDER_SEGMENTS.has(up)) return true;
    if (/^[A-Z]:$/.test(up)) return true;
    if (GENERIC_SEGMENT_REGEX.test(up)) return true;
    if (/^20\d{2}$/.test(up)) return true;
    return false;
}

function extractLastSpecificSegmentFromPath(filePath = '') {
    const raw = String(filePath || '').trim();
    if (!raw || /^desconhecido$/i.test(raw)) return null;

    // Strip UNC server host (e.g. \\TOMAS\...) and leading drive letter
    const stripped = raw
        .replace(/^\\\\[^\\/]+[\\/]?/, '')
        .replace(/^[A-Z]:[\\/]?/i, '');

    const segments = stripped
        .split(/[\\/]/)
        .map(s => s.trim())
        .filter(s => s && !FILE_EXT_REGEX.test(s));

    for (let i = segments.length - 1; i >= 0; i--) {
        if (!isGenericFolderSegment(segments[i])) {
            return segments[i];
        }
    }
    return null;
}

function resolveProjectFolder(rawFolder, filePath = '') {
    const raw = String(rawFolder || '').trim();
    if (raw) {
        const pipeParts = raw
            .replace(/^Router \d+\s*\|\s*/i, '')
            .replace(/^Router Central\s*\|\s*/i, '')
            .replace(/^Laser Ruida\s*\|\s*/i, '')
            .split(/\s*\|\s*/)
            .flatMap(p => p.split(/[\\/]/))
            .map(s => s.trim())
            .filter(s => s && !FILE_EXT_REGEX.test(s));

        for (let i = pipeParts.length - 1; i >= 0; i--) {
            if (!isGenericFolderSegment(pipeParts[i])) {
                return pipeParts[i];
            }
        }
    }

    const fromPath = extractLastSpecificSegmentFromPath(filePath);
    if (fromPath) return fromPath;

    if (raw && raw.includes(' | ')) {
        return raw.split(' | ').pop().trim() || 'Desconhecido';
    }
    return raw || 'Desconhecido';
}

function sanitizeMach3Timestamp(inputTime, { minBoundDate = null, fallbackDate = null } = {}) {
    const refNow = fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())
        ? fallbackDate
        : new Date();
    if (!inputTime) return refNow;

    const dt = inputTime instanceof Date ? new Date(inputTime.getTime()) : new Date(inputTime);
    if (Number.isNaN(dt.getTime())) return refNow;

    // Protect against dead BIOS/CMOS clocks (e.g. 2002-01-01) so jobs don't vanish or get auto-closed as stale
    if (dt.getUTCFullYear() < 2024) return refNow;

    // Protect against negative durations on job finish when CNC clock lags behind start_time
    if (minBoundDate instanceof Date && !Number.isNaN(minBoundDate.getTime())) {
        if ((minBoundDate.getTime() - dt.getTime()) > 60 * 1000) {
            return refNow;
        }
    }

    return dt;
}

module.exports = {
    GENERIC_FOLDER_SEGMENTS,
    isGenericFolderSegment,
    extractLastSpecificSegmentFromPath,
    resolveProjectFolder,
    sanitizeMach3Timestamp
};
