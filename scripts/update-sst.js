import fs from 'fs';
import path from 'path';
import axios from 'axios';

const locations = {
    jimbaran: { lat: -8.783715, lon: 115.125306, name: 'Jimbaran' },
    nusadua: { lat: -8.808350, lon: 115.263204, name: 'Nusa Dua' },
    sanur: { lat: -8.673680, lon: 115.277472, name: 'Sanur' }
};

async function fetchMarine(lat, lon) {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=sea_surface_temperature&timezone=Asia%2FSingapore&past_days=5&forecast_days=7`;
    const { data } = await axios.get(url, { timeout: 30000 });
    return data;
}

function dailyAverage(times, temps) {
    const byDate = new Map();
    for (let i = 0; i < times.length; i++) {
        const date = String(times[i]).split('T')[0];
        const val = temps[i];
        if (val == null) continue;
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(val);
    }
    const result = {};
    for (const [date, arr] of byDate.entries()) {
        if (arr.length === 0) continue;
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        result[date] = avg;
    }
    return result;
}

function mergeDates(perLocationDaily) {
    const allDates = new Set();
    for (const obj of Object.values(perLocationDaily)) {
        Object.keys(obj).forEach(d => allDates.add(d));
    }
    return Array.from(allDates).sort();
}

function toCSV(archive) {
    const dates = Object.keys(archive).sort();
    const rows = [ 'date,jimbaran,nusadua,sanur' ];
    for (const d of dates) {
        const r = archive[d] || {};
        const j = r.jimbaran ?? '';
        const n = r.nusadua ?? '';
        const s = r.sanur ?? '';
        rows.push(`${d},${j},${n},${s}`);
    }
    return rows.join('\n');
}

function readExistingCSV(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (lines.length <= 1) return {};
    const out = {};
    for (let i = 1; i < lines.length; i++) {
        const [date, jimbaran, nusadua, sanur] = lines[i].split(',');
        if (!date) continue;
        out[date] = {
            jimbaran: jimbaran ? Number(jimbaran) : '',
            nusadua: nusadua ? Number(nusadua) : '',
            sanur: sanur ? Number(sanur) : ''
        };
    }
    return out;
}

async function main() {
    const repoRoot = process.cwd();
    const outPath = path.join(repoRoot, 'current_sst.csv');

    // Load existing archive (if any) to keep full history
    const existing = readExistingCSV(outPath);

    // Fetch latest hourly, convert to daily
    const perLocationDaily = {};
    for (const [key, loc] of Object.entries(locations)) {
        try {
            const data = await fetchMarine(loc.lat, loc.lon);
            const daily = dailyAverage(data.hourly.time, data.hourly.sea_surface_temperature);
            perLocationDaily[key] = daily;
        } catch (e) {
            console.warn(`Failed to fetch for ${key}:`, e.message);
            perLocationDaily[key] = {};
        }
    }

    // Merge into archive
    const merged = { ...existing };
    const allDates = mergeDates(perLocationDaily);
    for (const d of allDates) {
        merged[d] = merged[d] || {};
        for (const key of Object.keys(locations)) {
            if (perLocationDaily[key] && perLocationDaily[key][d] != null) {
                merged[d][key] = perLocationDaily[key][d];
            }
        }
    }

    const csv = toCSV(merged);
    fs.writeFileSync(outPath, csv, 'utf8');
    console.log('Wrote', outPath, 'with', Object.keys(merged).length, 'rows');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});


