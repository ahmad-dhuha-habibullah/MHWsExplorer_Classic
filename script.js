// Marine Heatwave Explorer - Main JavaScript
class MarineHeatwaveExplorer {
    constructor() {
        this.locations = {
            jimbaran: { lat: -8.783715, lon: 115.125306, name: 'Jimbaran' },
            nusadua: { lat: -8.808350, lon: 115.263204, name: 'Nusa Dua' },
            sanur: { lat: -8.673680, lon: 115.277472, name: 'Sanur' }
        };
        
        this.currentDate = new Date('2025-09-10T13:19:00+08:00'); // 01:19 PM WIB, September 10, 2025
        this.baselineData = null;
        this.archivedSSTData = null; // This will store all historical data
        this.chart = null;
        this.currentLocation = 'jimbaran';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadBaselineData();
        await this.loadSSTData();
        this.setupDateInputs();
        
        // Wait for Chart.js to be available
        this.waitForChartJS().then(() => {
            this.updateChart();
            this.initMap();
        });
    }

    waitForChartJS() {
        return new Promise((resolve) => {
            const checkChart = () => {
                if (typeof Chart !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkChart, 100);
                }
            };
            checkChart();
        });
    }

    initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl || !window.L) return;
        if (this.map) return;

        this.map = L.map('map', { zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(this.map);

        const featureGroup = L.featureGroup();
        const locs = this.locations;
        const addMarker = (key) => {
            const loc = locs[key];
            const marker = L.marker([loc.lat, loc.lon]);
            marker.bindPopup(`<b>${loc.name}</b><br/>(${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})`);
            marker.on('click', () => {
                this.currentLocation = key;
                const select = document.getElementById('location-select');
                if (select) select.value = key;
                this.waitForChartJS().then(() => {
                    this.updateChart();
                    this.openModal();
                });
            });
            marker.addTo(featureGroup);
        };
        addMarker('jimbaran');
        addMarker('nusadua');
        addMarker('sanur');
        featureGroup.addTo(this.map);
        this._mapGroup = featureGroup;

        // Fit map to all markers (spreaded location position)
        this.fitMapToMarkers();

        // Recenter on resize
        window.addEventListener('resize', () => {
            if (this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                    this.fitMapToMarkers();
                }, 100);
            }
        });
    }

    fitMapToMarkers() {
        if (!this.map || !this._mapGroup) return;
        const bounds = this._mapGroup.getBounds();
        if (bounds && bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            // Fallback center to Nusa Dua
            const n = this.locations.nusadua;
            this.map.setView([n.lat, n.lon], 11);
        }
    }

    setupEventListeners() {
        document.getElementById('location-select').addEventListener('change', (e) => {
            this.currentLocation = e.target.value;
            this.waitForChartJS().then(() => {
                this.updateChart();
            });
        });

        document.getElementById('apply-dates').addEventListener('click', () => {
            this.waitForChartJS().then(() => {
                this.updateChart();
            });
        });

        document.getElementById('apply-y-axis').addEventListener('click', () => {
            this.waitForChartJS().then(() => {
                this.updateChart();
            });
        });

        const btnUpdate = document.getElementById('update-data');
        if (btnUpdate) {
            btnUpdate.addEventListener('click', () => this.updateSSTData());
        }

        const btnExport = document.getElementById('export-csv');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportCSV());
        }

        const btnReload = document.getElementById('reload-csv');
        if (btnReload) {
            btnReload.addEventListener('click', async () => {
                await this.loadArchivedDataFromCSV();
                await this.waitForChartJS();
                this.updateChart();
            });
        }

        const inputImport = document.getElementById('import-csv');
        if (inputImport) {
            inputImport.addEventListener('change', (e) => {
                this.importCSV(e.target.files[0]);
            });
        }

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
                document.getElementById(target).style.display = 'block';
                if (target === 'tab-home') this.updateBulletin();
                if (target === 'tab-map') {
                    setTimeout(() => { if (this.map) { this.map.invalidateSize(); this.fitMapToMarkers(); } }, 200);
                }
            });
        });

        // Expand to modal
        const expandBtn = document.getElementById('btn-expand');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.openModal());
        }

        // Download PNG
        const downloadBtn = document.getElementById('btn-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPNG());
        }

        // Jump buttons from hero
        document.querySelectorAll('[data-tab-jump]').forEach(el => {
            el.addEventListener('click', () => {
                const target = el.getAttribute('data-tab-jump');
                document.querySelector(`.tab-btn[data-tab="${target}"]`)?.click();
            });
        });
    }

    setupDateInputs() {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        
        document.getElementById('start-date').value = startOfYear.toISOString().split('T')[0];
        document.getElementById('end-date').value = today.toISOString().split('T')[0];
    }

    async loadBaselineData() {
        try {
            this.updateStatus('Loading baseline data...');
            const response = await fetch('baseline.csv');
            const csvText = await response.text();
            
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    this.baselineData = results.data;
                    this.updateStatus('Baseline data loaded successfully');
                },
                error: (error) => {
                    console.error('Error parsing baseline CSV:', error);
                    this.updateStatus('Error loading baseline data', 'error');
                }
            });
        } catch (error) {
            console.error('Error loading baseline data:', error);
            this.updateStatus('Error loading baseline data', 'error');
        }
    }

    async loadSSTData() {
        try {
            this.updateStatus('Loading archived SST data...');
            
            // Load archived data from CSV file first and wait until parsed
            await this.loadArchivedDataFromCSV();
            
            // Immediately render from the archived CSV
            await this.waitForChartJS();
            this.updateChart();
            this.updateBulletin();

            // Always allow manual update via button; auto-update only if desired.
        } catch (error) {
            console.error('Error loading SST data:', error);
            this.updateStatus('Error loading SST data', 'error');
        }
    }

    async fetchAndProcessSSTData() {
        try {
            this.updateStatus('Fetching fresh SST data...');
            const allLocationData = {};

            for (const [locationKey, location] of Object.entries(this.locations)) {
                try {
                    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${location.lat}&longitude=${location.lon}&hourly=sea_surface_temperature&timezone=Asia%2FSingapore&past_days=5&forecast_days=7`;
                    const response = await axios.get(url);
                    allLocationData[locationKey] = response.data;
                } catch (apiError) {
                    console.warn(`API failed for ${locationKey}, using fallback data`);
                    // Use fallback data for all locations
                    const fallbackResponse = await fetch('sst_example.json');
                    const fallbackData = await fallbackResponse.json();
                    allLocationData[locationKey] = fallbackData;
                }
            }

            // Process to daily averages and merge into archive
            this.processSSTData(allLocationData);
            // After merging, regenerate current_sst.csv to disk (download) so user can replace file on server
            this.generateAndDownloadCSV();
            localStorage.setItem('lastSSTUpdate', Date.now().toString());
            this.updateStatus('SST data updated and CSV generated. Replace current_sst.csv on the server to make it live.', 'success');
        } catch (error) {
            console.error('Error fetching SST data:', error);
            // Try to load from storage as fallback
            this.loadSSTDataFromStorage();
        }
    }

    async loadArchivedDataFromCSV() {
        try {
            // Cache-bust to ensure latest edits are fetched
            const url = `current_sst.csv?ts=${Date.now()}`;
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
                const csvText = await response.text();
                // Wrap Papa.parse in a Promise so callers can await completion
                await new Promise((resolve, reject) => {
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        delimiter: (csvText.indexOf('\t') !== -1 ? '\t' : ','),
                        complete: (results) => {
                            try {
                                this.archivedSSTData = this.convertCSVToArchivedData(results.data);
                                this.updateStatus('SST archive loaded', 'success');
                                resolve();
                            } catch (e) {
                                reject(e);
                            }
                        },
                        error: (error) => {
                            reject(error);
                        }
                    });
                });
            } else {
                // CSV file doesn't exist, create new archive
                this.archivedSSTData = {};
                this.updateStatus('No archived CSV found, creating new archive', 'info');
            }
        } catch (error) {
            console.warn('Error loading archived CSV, creating new archive:', error);
            this.archivedSSTData = {};
            this.updateStatus('Creating new archive', 'info');
        }
    }

    convertCSVToArchivedData(csvData) {
        const archivedData = {};
        
        const normalizeDate = (value) => {
            if (!value) return '';
            const v = String(value).trim();
            // Accept YYYY-MM-DD directly
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
            // Accept DD-MM-YYYY or DD/MM/YYYY
            let m = v.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
            if (m) {
                const [_, dd, mm, yyyy] = m;
                return `${yyyy}-${mm}-${dd}`;
            }
            // Accept D-M-YYYY single digits
            m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
            if (m) {
                let dd = m[1].padStart(2, '0');
                let mm = m[2].padStart(2, '0');
                const yyyy = m[3];
                return `${yyyy}-${mm}-${dd}`;
            }
            // If Excel exported as DD.MM.YYYY
            m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (m) {
                const [_, dd, mm, yyyy] = m;
                return `${yyyy}-${mm}-${dd}`;
            }
            // Fallback: try Date parse and reformat
            const d = new Date(v);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
            return '';
        };
        
        const parseNumber = (value) => {
            if (value === undefined || value === null) return null;
            let s = String(value).trim();
            if (s === '') return null;
            // Replace decimal comma with dot, remove thousand spaces
            s = s.replace(/\s+/g, '').replace(',', '.');
            const n = Number(s);
            return isNaN(n) ? null : n;
        };
        
        for (const row of csvData) {
            const dateRaw = row.date ?? row.Date ?? row.DATE ?? '';
            const date = normalizeDate(dateRaw);
            if (!date) continue;

            const jim = row.jimbaran ?? row.Jimbaran ?? row.JIMBARAN;
            const ndua = row.nusadua ?? row.NusaDua ?? row.NUSADUA ?? row['nusa dua'] ?? row['Nusa Dua'];
            const san = row.sanur ?? row.Sanur ?? row.SANUR;

            archivedData[date] = {
                jimbaran: parseNumber(jim),
                nusadua: parseNumber(ndua),
                sanur: parseNumber(san)
            };
        }
        
        // Debug bounds
        const keys = Object.keys(archivedData).sort();
        if (keys.length) {
            console.log(`CSV parsed dates: ${keys[0]} .. ${keys[keys.length - 1]} (${keys.length} days)`);
        }
        
        return archivedData;
    }

    loadArchivedDataFromStorage() {
        const storedData = localStorage.getItem('archived_sst_data');
        if (storedData) {
            this.archivedSSTData = JSON.parse(storedData);
            this.updateStatus('Archived SST data loaded from storage', 'success');
        } else {
            this.archivedSSTData = {};
            this.updateStatus('No archived SST data available, will create new archive', 'info');
        }
    }

    loadSSTDataFromStorage() {
        const storedData = localStorage.getItem('current_sst');
        if (storedData) {
            this.sstData = JSON.parse(storedData);
            this.updateStatus('SST data loaded from storage', 'success');
        } else {
            this.updateStatus('No stored SST data available', 'error');
        }
    }

    processSSTData(allLocationData) {
        const newDailyData = {};

        for (const [locationKey, data] of Object.entries(allLocationData)) {
            const hourlyTimes = data.hourly.time;
            const hourlyTemps = data.hourly.sea_surface_temperature;

            // Group by date and calculate daily averages
            const dailyAverages = {};
            for (let i = 0; i < hourlyTimes.length; i++) {
                const date = hourlyTimes[i].split('T')[0];
                if (!dailyAverages[date]) {
                    dailyAverages[date] = [];
                }
                if (hourlyTemps[i] !== null) {
                    dailyAverages[date].push(hourlyTemps[i]);
                }
            }

            // Calculate daily averages
            for (const [date, temps] of Object.entries(dailyAverages)) {
                if (temps.length > 0) {
                    const avgTemp = temps.reduce((sum, temp) => sum + temp, 0) / temps.length;
                    if (!newDailyData[date]) {
                        newDailyData[date] = {};
                    }
                    newDailyData[date][locationKey] = avgTemp;
                }
            }
        }

        // Merge new data with archived data
        this.mergeWithArchivedData(newDailyData);
        
        // Set current data for immediate use
        this.sstData = newDailyData;
    }

    mergeWithArchivedData(newData) {
        // Initialize archived data if it doesn't exist
        if (!this.archivedSSTData) {
            this.archivedSSTData = {};
        }

        // Merge new data with archived data
        for (const [date, locationData] of Object.entries(newData)) {
            if (!this.archivedSSTData[date]) {
                this.archivedSSTData[date] = {};
            }
            
            // Update each location's data for this date
            for (const [location, temp] of Object.entries(locationData)) {
                this.archivedSSTData[date][location] = temp;
            }
        }

        // Save updated archive
        this.saveArchivedDataToStorage();
        
        // Debug info
        const totalDates = Object.keys(this.archivedSSTData).length;
        console.log(`Archived data updated. Total dates: ${totalDates}`);
    }

    saveArchivedDataToStorage() {
        if (this.archivedSSTData) {
            // Save to localStorage as backup
            localStorage.setItem('archived_sst_data', JSON.stringify(this.archivedSSTData));
            
            // Generate and download CSV file
            this.generateAndDownloadCSV();
        }
    }

    generateAndDownloadCSV() {
        if (!this.archivedSSTData) return;

        // Convert archived data to CSV format
        const csvData = this.convertArchivedDataToCSV();
        
        // Create CSV content
        const csvContent = this.arrayToCSV(csvData);
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'current_sst.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('CSV file generated and downloaded');
    }

    convertArchivedDataToCSV() {
        const dates = Object.keys(this.archivedSSTData).sort();
        const csvData = [];
        
        for (const date of dates) {
            const row = {
                date: date,
                jimbaran: this.archivedSSTData[date].jimbaran || '',
                nusadua: this.archivedSSTData[date].nusadua || '',
                sanur: this.archivedSSTData[date].sanur || ''
            };
            csvData.push(row);
        }
        
        return csvData;
    }

    arrayToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        return csvContent;
    }

    saveSSTDataToStorage() {
        if (this.sstData) {
            localStorage.setItem('current_sst', JSON.stringify(this.sstData));
        }
    }

    getDayOfYear(dateString) {
        const date = new Date(dateString);
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    isLeapYear(y) {
        return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    }

    getAdjustedDoy(dateString) {
        const d = new Date(dateString);
        const doy = this.getDayOfYear(dateString);
        const feb28 = new Date(d.getFullYear(), 1, 28);
        if (this.isLeapYear(d.getFullYear()) && d > feb28) return doy - 1;
        return doy;
    }

    getBaselineForDate(dateString, locationKey) {
        if (!this.baselineData) return { clim: null, p90: null };
        const dayOfYear = this.getAdjustedDoy(dateString);
        const baselineRow = this.baselineData.find(row => {
            const key = row['day of year'] !== undefined ? 'day of year' : (row['day_of_year'] !== undefined ? 'day_of_year' : null);
            if (!key) return false;
            return parseInt(row[key]) === dayOfYear;
        });
        if (!baselineRow) return { clim: null, p90: null };
        const hasGeneric = baselineRow['climatology_mean'] !== undefined || baselineRow['percentile_90'] !== undefined;
        const sigma = baselineRow['sigma'] !== undefined ? parseFloat(baselineRow['sigma']) : null;
        if (hasGeneric) {
            return {
                clim: parseFloat(baselineRow['climatology_mean'] ?? null),
                p90: parseFloat(baselineRow['percentile_90'] ?? null),
                sigma
            };
        }
        return {
            clim: parseFloat(baselineRow[`${locationKey}_clim`]),
            p90: parseFloat(baselineRow[`${locationKey}_p90`]),
            sigma
        };
    }

    detectMarineHeatwaves() {
        if (!this.archivedSSTData || !this.baselineData) return [];

        const dates = Object.keys(this.archivedSSTData).sort();
        const heatwaves = [];
        let currentHeatwave = null;

        for (const date of dates) {
            const sst = this.archivedSSTData[date][this.currentLocation];
            if (sst === undefined) continue;

            const baseline = this.getBaselineForDate(date, this.currentLocation);
            if (!baseline.clim || !baseline.p90) continue;

            const isHeatwave = sst > baseline.p90;

            if (isHeatwave) {
                if (!currentHeatwave) {
                    currentHeatwave = {
                        startDate: date,
                        peakDate: date,
                        peakTemp: sst,
                        maxIntensity: sst - baseline.p90,
                        category: this.getHeatwaveCategory(sst - baseline.p90),
                        dates: [date],
                        temps: [sst],
                        baselines: [baseline]
                    };
                } else {
                    currentHeatwave.dates.push(date);
                    currentHeatwave.temps.push(sst);
                    currentHeatwave.baselines.push(baseline);
                    
                    if (sst > currentHeatwave.peakTemp) {
                        currentHeatwave.peakDate = date;
                        currentHeatwave.peakTemp = sst;
                        currentHeatwave.maxIntensity = sst - baseline.p90;
                        currentHeatwave.category = this.getHeatwaveCategory(sst - baseline.p90);
                    }
                }
            } else {
                if (currentHeatwave && currentHeatwave.dates.length >= 5) {
                    heatwaves.push(currentHeatwave);
                }
                currentHeatwave = null;
            }
        }

        // Add the last heatwave if it exists
        if (currentHeatwave && currentHeatwave.dates.length >= 5) {
            heatwaves.push(currentHeatwave);
        }

        return heatwaves;
    }

    getHeatwaveCategory(intensity) {
        if (intensity >= 4) return 'Category IV';
        if (intensity >= 3) return 'Category III';
        if (intensity >= 2) return 'Category II';
        if (intensity >= 1) return 'Category I';
        return 'Heat Spike';
    }

    getHeatwaveColor(category) {
        const colors = {
            'Heat Spike': '#ffb6c1',
            'Category I': '#ffff00',
            'Category II': '#ffa500',
            'Category III': '#ff4500',
            'Category IV': '#8b0000'
        };
        return colors[category] || '#ffb6c1';
    }

    generateDateRange(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        
        return dates;
    }

    prepareChartData(dates, location) {
        const sstValues = [];
        const baselineData = [];
        
        for (const date of dates) {
            // Get SST value from archived data
            const sstValue = this.archivedSSTData[date] && 
                           this.archivedSSTData[date][location] !== undefined 
                           ? this.archivedSSTData[date][location] 
                           : null;
            sstValues.push(sstValue);
            
            // Get baseline data
            const baseline = this.getBaselineForDate(date, location);
            baselineData.push({
                clim: baseline.clim,
                p90: baseline.p90
            });
        }
        
        return { sstValues, baselineData };
    }

    detectMarineHeatwavesFromData(dates, sstValues, baselineData) {
        const events = [];
        let inEvent = false;
        let current = [];
        const dateToMeta = new Map();

        const classifyEvent = (ev) => {
            const anomalies = ev.map(r => r.anomaly);
            const maxAnomaly = Math.max(...anomalies);
            const minAnomaly = Math.min(...anomalies);
            const meanAnomaly = anomalies.reduce((a,b)=>a+b,0) / ev.length;
            const cumAnomaly = anomalies.reduce((a,b)=>a+b,0);
            // Event category based on max of per-day delta categories within the event
            const eventCategory = ev.reduce((m, r) => Math.max(m, r.deltaCategory), 0);
            return { start: ev[0].date, end: ev[ev.length-1].date, duration: ev.length, maxAnomaly, minAnomaly, meanAnomaly, cumAnomaly, category: eventCategory };
        };

        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const sst = sstValues[i];
            const baseline = baselineData[i];
            if (sst === null || !baseline || baseline.p90 == null) {
                if (inEvent && current.length >= 5) {
                    const ev = classifyEvent(current);
                    events.push(ev);
                    current.forEach(r => dateToMeta.set(r.date, { anomaly: r.anomaly, category: r.deltaCategory, threshold: r.threshold, clim: r.clim }));
                }
                inEvent = false; current = [];
                continue;
            }
            const threshold = baseline.p90;
            const clim = baseline.clim;
            const anomaly = sst - threshold;
            if (anomaly > 0) {
                // Delta-based category per day
                const delta = (threshold != null && clim != null) ? (threshold - clim) : null;
                const excess = (threshold != null) ? (sst - threshold) : null;
                let deltaCategory = 0;
                if (delta != null && excess != null) {
                    if (excess > 0 && excess < 1*delta) deltaCategory = 1;
                    else if (excess >= 1*delta && excess < 2*delta) deltaCategory = 2;
                    else if (excess >= 2*delta && excess < 3*delta) deltaCategory = 3;
                    else if (excess >= 3*delta) deltaCategory = 4;
                }
                current.push({ date, sst, anomaly, threshold, clim, deltaCategory });
                inEvent = true;
            } else {
                if (inEvent && current.length >= 5) {
                    const ev = classifyEvent(current);
                    events.push(ev);
                    current.forEach(r => dateToMeta.set(r.date, { anomaly: r.anomaly, category: r.deltaCategory, threshold: r.threshold, clim: r.clim }));
                }
                inEvent = false; current = [];
            }
        }
        if (inEvent && current.length >= 5) {
            const ev = classifyEvent(current);
            events.push(ev);
            current.forEach(r => dateToMeta.set(r.date, { anomaly: r.anomaly, category: r.deltaCategory, threshold: r.threshold, clim: r.clim }));
        }
        return { events, dateToMeta };
    }

    getHeatwaveCategoryLabel(catNum) {
        switch (catNum) {
            case 1: return 'Category I';
            case 2: return 'Category II';
            case 3: return 'Category III';
            case 4: return 'Category IV';
            default: return 'Heat Spike';
        }
    }

    updateChart() {
        if (!this.archivedSSTData || !this.baselineData) {
            this.updateStatus('Waiting for data to load...');
            return;
        }

        if (typeof Chart === 'undefined') {
            this.updateStatus('Chart.js library not loaded. Please refresh the page.', 'error');
            return;
        }

        const ctx = document.getElementById('heatwave-chart').getContext('2d');
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const yMin = parseFloat(document.getElementById('y-min').value);
        const yMax = parseFloat(document.getElementById('y-max').value);

        // Generate all dates in the range, including missing dates
        const allDates = this.generateDateRange(startDate, endDate);
        
        // Filter archived data by date range and fill missing dates
        const filteredData = this.prepareChartData(allDates, this.currentLocation);

        const sstValues = filteredData.sstValues;
        const baselineData = filteredData.baselineData;
        
        // Debug info
        const availableData = sstValues.filter(val => val !== null).length;
        console.log(`Chart update: ${allDates.length} total dates, ${availableData} with data`);

        // Detect events and per-date metadata
        const { events, dateToMeta } = this.detectMarineHeatwavesFromData(allDates, sstValues, baselineData);
        // Persist context for reuse in modal tooltips
        this._tooltipContext = { events, dateToMeta };

        // Today reference (used for past/forecast split and vertical line)
        const nowDate = this.currentDate.toISOString().split('T')[0];

        // Build per-date category map for shading bands based on simple exceedance of p90
        const dateToCategory = new Map();
        for (let i = 0; i < allDates.length; i++) {
            const d = allDates[i];
            const meta = dateToMeta.get(d);
            if (meta) {
                dateToCategory.set(d, this.getHeatwaveCategoryLabel(meta.category));
            }
        }

        // Prepare category datasets arrays aligned to allDates (Category I–IV only)
        const catSeries = {
            'Category I': new Array(allDates.length).fill(null),
            'Category II': new Array(allDates.length).fill(null),
            'Category III': new Array(allDates.length).fill(null),
            'Category IV': new Array(allDates.length).fill(null)
        };
        for (let i = 0; i < allDates.length; i++) {
            const d = allDates[i];
            const cat = dateToCategory.get(d);
            if (cat && sstValues[i] != null && catSeries[cat]) {
                catSeries[cat][i] = sstValues[i];
            }
        }

        // Prepare chart data
        const datasets = [
            // SST data (solid black line) up to and including today
            {
                label: 'SST',
                data: allDates.map((date, index) => ({ x: date, y: (date <= nowDate ? sstValues[index] : null) }))
                               .filter(point => point.y !== null),
                borderColor: '#000000',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointStyle: 'line',
                order: 10
            },
            // Forecast SST data (dashed line) only after today
            {
                label: 'Forecast SST',
                data: allDates.map((date, index) => ({ x: date, y: (date > nowDate ? sstValues[index] : null) }))
                               .filter(point => point.y !== null),
                borderColor: '#a0a0a0',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointStyle: 'line',
                order: 9
            },
            // Climatological mean (dashed blue line)
            {
                label: 'Climatological Mean',
                data: allDates.map((date, index) => ({
                    x: date,
                    y: baselineData[index].clim
                })).filter(point => point.y !== null),
                borderColor: '#0000ff',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 4,
                pointStyle: 'line',
                order: 8
            },
            // 90th percentile threshold (solid green line)
            {
                label: '90th Percentile',
                data: allDates.map((date, index) => ({
                    x: date,
                    y: baselineData[index].p90
                })).filter(point => point.y !== null),
                borderColor: '#008000',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointStyle: 'line',
                order: 7
            },
            // Heatwave shaded fills per category (each fills to previous dataset = p90)
            {
                label: 'Category I',
                data: allDates.map((date, i) => ({ x: date, y: catSeries['Category I'][i] })),
                borderWidth: 0,
                showLine: true,
                spanGaps: false,
                pointRadius: 0,
                borderColor: 'transparent',
                backgroundColor: this.hexToRgba('#ffd39b', 0.6),
                fill: 3,
                pointStyle: 'rect',
                order: -10
            },
            {
                label: 'Category II',
                data: allDates.map((date, i) => ({ x: date, y: catSeries['Category II'][i] })),
                borderWidth: 0,
                showLine: true,
                spanGaps: false,
                pointRadius: 0,
                borderColor: 'transparent',
                backgroundColor: this.hexToRgba('#ffa64d', 0.55),
                fill: 3,
                pointStyle: 'rect',
                order: -10
            },
            {
                label: 'Category III',
                data: allDates.map((date, i) => ({ x: date, y: catSeries['Category III'][i] })),
                borderWidth: 0,
                showLine: true,
                spanGaps: false,
                pointRadius: 0,
                borderColor: 'transparent',
                backgroundColor: this.hexToRgba('#ff6347', 0.55),
                fill: 3,
                pointStyle: 'rect',
                order: -10
            },
            {
                label: 'Category IV',
                data: allDates.map((date, i) => ({ x: date, y: catSeries['Category IV'][i] })),
                borderWidth: 0,
                showLine: true,
                spanGaps: false,
                pointRadius: 0,
                borderColor: 'transparent',
                backgroundColor: this.hexToRgba('#8b0000', 0.55),
                fill: 3,
                pointStyle: 'rect',
                order: -10
            }
        ];


        // Add "now" vertical line
        if (nowDate >= startDate && nowDate <= endDate) {
            datasets.push({
                label: 'Now',
                data: [
                    { x: nowDate, y: yMin },
                    { x: nowDate, y: yMax }
                ],
                borderColor: '#ff0000',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0
            });
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'PP',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        ticks: {
                            source: 'auto',
                            autoSkip: true,
                            maxTicksLimit: 12
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        usePointStyle: true,
                        callbacks: {
                            title: (context) => new Date(context[0].parsed.x).toLocaleDateString(),
                            label: (context) => {
                                const dsLabel = context.dataset.label || '';
                                const y = context.parsed.y;
                                const x = context.parsed.x;
                                return `${dsLabel}: ${y != null ? y.toFixed(2) : '—'}°C`;
                            },
                            labelPointStyle: (context) => {
                                const lineLabels = new Set(['SST','Forecast SST','Climatological Mean','90th Percentile','Now']);
                                const dsLabel = context.dataset.label || '';
                                if (lineLabels.has(dsLabel)) {
                                    return { pointStyle: 'line', rotation: 0 };
                                }
                                return { pointStyle: 'rect', rotation: 0 };
                            },
                            afterBody: (context) => {
                                if (!context || context.length === 0) return [];
                                const x = context[0].parsed.x;
                                const dateStr = new Date(x).toISOString().split('T')[0];
                                const meta = this._tooltipContext && this._tooltipContext.dateToMeta ? this._tooltipContext.dateToMeta.get(dateStr) : null;
                                const events = this._tooltipContext ? this._tooltipContext.events : [];
                                const lines = [];
                                if (meta) {
                                    lines.push(`Anomaly: ${meta.anomaly.toFixed(2)}°C`);
                                    lines.push(`Category: ${this.getHeatwaveCategoryLabel(meta.category)}`);
                                    const ev = events.find(e => dateStr >= e.start && dateStr <= e.end);
                                    if (ev) {
                                        lines.push(`Duration: ${ev.duration} days`);
                                        lines.push(`Max anomaly: ${ev.maxAnomaly.toFixed(2)}°C`);
                                        if (ev.minAnomaly !== undefined) lines.push(`Min anomaly: ${ev.minAnomaly.toFixed(2)}°C`);
                                        lines.push(`Mean intensity: ${ev.meanAnomaly.toFixed(2)}°C`);
                                        lines.push(`Cumulative intensity: ${ev.cumAnomaly.toFixed(2)}°C·day`);
                                    }
                                }
                                return lines;
                            },
                            itemSort: (a, b) => {
                                const priority = (lbl) => {
                                    if (lbl.startsWith('Category ')) return 0;
                                    return 1;
                                };
                                const pa = priority(a.dataset.label || '');
                                const pb = priority(b.dataset.label || '');
                                if (pa !== pb) return pa - pb;
                                return 0;
                            }
                        }
                    }
                }
            }
        });

        // Hide custom HTML legend if present (use built-in legend only)
        const htmlLegend = document.querySelector('.legend.sticky-legend');
        if (htmlLegend) htmlLegend.style.display = 'none';
    }

    hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    openModal() {
        const existing = document.getElementById('chart-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'chart-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
        modal.innerHTML = '<div style="width:90vw;height:85vh;background:#fff;border-radius:0;position:relative;box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;flex-direction:column">'
            + '<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e5e7eb">'
            + '<div style="font-weight:600">Chart</div>'
            + '<div>'
            + '<button id="modal-export" class="btn small" style="margin-right:8px">Export PNG</button>'
            + '<button id="modal-close" class="btn small">Close</button>'
            + '</div>'
            + '</div>'
            + '<div style="flex:1 1 auto;padding:12px"><canvas id="modal-canvas" style="width:100%;height:100%"></canvas></div>'
            + '</div>';
        document.body.appendChild(modal);
        document.getElementById('modal-close').onclick = () => modal.remove();
        // clone chart into modal
        const ctx = document.getElementById('modal-canvas').getContext('2d');
        const config = this.chart.config;
        const data = JSON.parse(JSON.stringify(config.data));
        const options = JSON.parse(JSON.stringify(config.options));
        // Reattach detailed tooltip callbacks for modal using stored context
        options.plugins = options.plugins || {};
        options.plugins.tooltip = options.plugins.tooltip || {};
        options.plugins.tooltip.usePointStyle = true;
        options.plugins.tooltip.callbacks = {
            title: (context) => new Date(context[0].parsed.x).toLocaleDateString(),
            label: (context) => {
                const dsLabel = context.dataset.label || '';
                const y = context.parsed.y;
                return `${dsLabel}: ${y != null ? y.toFixed(2) : '—'}°C`;
            },
            labelPointStyle: (context) => {
                const lineLabels = new Set(['SST','Forecast SST','Climatological Mean','90th Percentile','Now']);
                const dsLabel = context.dataset.label || '';
                if (lineLabels.has(dsLabel)) return { pointStyle: 'line', rotation: 0 };
                return { pointStyle: 'rect', rotation: 0 };
            },
            afterBody: (context) => {
                if (!context || context.length === 0) return [];
                const x = context[0].parsed.x;
                const dateStr = new Date(x).toISOString().split('T')[0];
                const meta = this._tooltipContext && this._tooltipContext.dateToMeta ? this._tooltipContext.dateToMeta.get(dateStr) : null;
                const events = this._tooltipContext ? this._tooltipContext.events : [];
                const lines = [];
                if (meta) {
                    lines.push(`Anomaly: ${meta.anomaly.toFixed(2)}°C`);
                    lines.push(`Category: ${this.getHeatwaveCategoryLabel(meta.category)}`);
                    const ev = events.find(e => dateStr >= e.start && dateStr <= e.end);
                    if (ev) {
                        lines.push(`Duration: ${ev.duration} days`);
                        lines.push(`Max anomaly: ${ev.maxAnomaly.toFixed(2)}°C`);
                        if (ev.minAnomaly !== undefined) lines.push(`Min anomaly: ${ev.minAnomaly.toFixed(2)}°C`);
                        lines.push(`Mean intensity: ${ev.meanAnomaly.toFixed(2)}°C`);
                        lines.push(`Cumulative intensity: ${ev.cumAnomaly.toFixed(2)}°C·day`);
                    }
                }
                return lines;
            },
            itemSort: (a, b) => {
                const priority = (lbl) => {
                    if (lbl.startsWith('Category ')) return 0;
                    return 1;
                };
                const pa = priority(a.dataset.label || '');
                const pb = priority(b.dataset.label || '');
                if (pa !== pb) return pa - pb;
                return 0;
            }
        };
        const modalChart = new Chart(ctx, { type: 'line', data, options });
        document.getElementById('modal-export').onclick = () => {
            const url = modalChart.toBase64Image();
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mhw_chart.png';
            a.click();
        };
    }

    downloadPNG() {
        if (!this.chart) return;
        const url = this.chart.toBase64Image();
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mhw_chart.png';
        a.click();
    }

    async updateSSTData() {
        this.updateStatus('Updating SST data...');
        await this.fetchAndProcessSSTData();
        this.waitForChartJS().then(() => {
            this.updateChart();
        });
    }

    exportCSV() {
        if (!this.archivedSSTData || Object.keys(this.archivedSSTData).length === 0) {
            this.updateStatus('No data to export', 'error');
            return;
        }
        
        this.updateStatus('Exporting CSV...', 'info');
        this.generateAndDownloadCSV();
        this.updateStatus('CSV exported successfully', 'success');
    }

    importCSV(file) {
        if (!file) return;
        
        this.updateStatus('Importing CSV...', 'info');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    try {
                        const importedData = this.convertCSVToArchivedData(results.data);
                        
                        // Merge with existing data
                        if (!this.archivedSSTData) {
                            this.archivedSSTData = {};
                        }
                        
                        for (const [date, locationData] of Object.entries(importedData)) {
                            if (!this.archivedSSTData[date]) {
                                this.archivedSSTData[date] = {};
                            }
                            
                            // Update each location's data
                            for (const [location, temp] of Object.entries(locationData)) {
                                if (temp !== null) {
                                    this.archivedSSTData[date][location] = temp;
                                }
                            }
                        }
                        
                        // Save updated data
                        this.saveArchivedDataToStorage();
                        
                        // Update chart
                        this.waitForChartJS().then(() => {
                            this.updateChart();
                        });
                        
                        this.updateStatus('CSV imported successfully', 'success');
                        
                        // Clear the file input
                        document.getElementById('import-csv').value = '';
                        
                    } catch (error) {
                        console.error('Error processing imported CSV:', error);
                        this.updateStatus('Error processing CSV file', 'error');
                    }
                },
                error: (error) => {
                    console.error('Error parsing CSV:', error);
                    this.updateStatus('Error parsing CSV file', 'error');
                }
            });
        };
        
        reader.readAsText(file);
    }

    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = message;
        statusElement.className = type;
        
        if (type === 'success') {
            const lastUpdateElement = document.getElementById('last-update');
            lastUpdateElement.textContent = `Last updated: ${new Date().toLocaleString()}`;
        }
    }

    // Bulletin generator for Home tab
    updateBulletin() {
        if (!this.archivedSSTData || !this.baselineData) return;
        const locations = ['jimbaran','nusadua','sanur'];
        const today = new Date().toISOString().split('T')[0];
        const start = new Date(new Date(today).getFullYear(), 0, 1).toISOString().split('T')[0];
        const dates = this.generateDateRange(start, today);
        for (const loc of locations) {
            const { sstValues, baselineData } = this.prepareChartData(dates, loc);
            const { events, dateToMeta } = this.detectMarineHeatwavesFromData(dates, sstValues, baselineData);
            const chip = document.getElementById(`chip-${loc}`);
            const anom = document.getElementById(`anom-${loc}`);
            const metaBox = document.getElementById(`meta-${loc}`);
            if (!chip || !anom || !metaBox) continue;
            const meta = dateToMeta.get(today);
            const current = meta ? this.getHeatwaveCategoryLabel(meta.category) : 'No MHW';
            const currentAnom = meta ? `${meta.anomaly.toFixed(2)}°C` : '—';
            chip.textContent = current;
            // Blue when no MHW; warm reds/oranges as severity increases
            const color = meta && meta.category ? (meta.category>=4?'#b91c1c':meta.category>=3?'#c2410c':meta.category>=2?'#d97706':'#65a30d') : '#2563eb';
            chip.style.setProperty('color', color);
            chip.style.setProperty('border-color', color);
            chip.style.setProperty('background', 'transparent');
            anom.textContent = currentAnom;
            const last = events.length ? events[events.length - 1] : null;
            metaBox.innerHTML = last ? `<div>Recent: ${last.start} → ${last.end}</div><div>Peak +${last.maxAnomaly.toFixed(2)}°C, ${this.getHeatwaveCategoryLabel(last.category)}</div>` : `<div>No recent events</div>`;
        }
        // Wire buttons
        document.querySelectorAll('[data-browse-loc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = btn.getAttribute('data-browse-loc');
                this.currentLocation = loc;
                const select = document.getElementById('location-select');
                if (select) select.value = loc;
                document.querySelector('.tab-btn[data-tab="tab-chart"]').click();
            });
        });
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MarineHeatwaveExplorer();
});
