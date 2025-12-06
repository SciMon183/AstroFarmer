const VOC_LEVELS = [
    { max: 100, label: "Doskonałe", action: "Brak działań" },
    { max: 200, label: "Dobre", action: "Monitoruj trend" },
    { max: 300, label: "Lekkie zanieczyszczenie", action: "Przewietrz pomieszczenie" },
    { max: 400, label: "Średnie zanieczyszczenie", action: "Zwiększ wymianę powietrza" },
    { max: 500, label: "Silne zanieczyszczenie", action: "Konieczna optymalizacja wentylacji" },
];

const API_ENDPOINTS = {
    latest: "",
    history: "",
    export: "",
};

const floorLabels = ["Piętro 1", "Piętro 2"];
let sensorSnapshot = createPlaceholderSnapshot();
let sensorHistory = createPlaceholderHistory();
const chartRegistry = new Map();

const DUPLICATED_SENSOR_SCHEMAS = [
    { id: "temperature", label: "Temperatura półek", unit: "°C", accessor: s => s.shelves.map(f => f.temperature) },
    { id: "humidity", label: "Wilgotność względna", unit: "%", accessor: s => s.shelves.map(f => f.humidity) },
    { id: "soil", label: "Wilgotność gleby", unit: "%", accessor: s => s.shelves.map(f => f.soil) },
];

const uniqueSensors = [
    {
        id: "airQualityIndex",
        label: "Wskaźnik VOC",
        unit: "indeks",
        meta: v => {
            const state = VOC_LEVELS.find(r => v <= r.max) ?? VOC_LEVELS[VOC_LEVELS.length - 1];
            return { badge: state.label, badgeClass: classifyState(state.label), hint: state.action };
        },
    },
    { id: "envPRES", label: "Ciśnienie", unit: "hPa", hint: "BMP280" },
    {
        id: "CO2ppm",
        label: "CO₂",
        unit: "ppm",
        meta: v => ({
            badge: v < 800 ? "Stabilne" : v < 1200 ? "Uwaga" : "Alarm",
            badgeClass: v < 800 ? "" : v < 1200 ? "warn" : "critical",
            hint: v < 800 ? "Optymalny poziom" : "Popraw cyrkulację powietrza",
        }),
    },
    { id: "envUV", label: "UV", unit: "mW/cm²", hint: "Czujnik ML8511" },
    { id: "envLI", label: "Natężenie światła", unit: "lx", hint: "VEML7700" },
    { id: "LUX", label: "Kanał LUX", unit: "lx", hint: "Spektrometr AS7341" },
    { id: "CCT", label: "CCT", unit: "K", hint: "Temperatura barwowa" },
    { id: "envTEMP", label: "Temp. otoczenia", unit: "°C", hint: "Czujnik środowiskowy" },
];

function classifyState(label) {
    if (/alarm|silne/i.test(label)) return "critical";
    if (/uwaga|średnie|lekkie|polluted/i.test(label)) return "warn";
    return "";
}

function formatNumber(value) {
    return typeof value === "number" ? value.toLocaleString("pl-PL", { maximumFractionDigits: 1 }) : value;
}

function renderUniqueCards() {
    const container = document.getElementById("uniqueGrid");
    container.innerHTML = "";
    uniqueSensors.forEach(sensor => {
        const value = sensorSnapshot[sensor.id];
        const meta = sensor.meta?.(value);
        const card = document.createElement("article");
        card.className = "data-card";
        card.innerHTML = `
            <header>
                <h3>${sensor.label}</h3>
                ${meta?.badge ? `<span class="status-pill ${meta.badgeClass ?? ""}">${meta.badge}</span>` : ""}
            </header>
            <p class="sensor-value">${formatNumber(value)}${sensor.unit ? `<span>${sensor.unit}</span>` : ""}</p>
            <p class="sensor-meta">${meta?.hint ?? sensor.hint ?? ""}</p>
            <div class="chart-wrapper">
                <canvas id="chart-${sensor.id}" class="sensor-chart" aria-label="Wykres ${sensor.label}" role="img"></canvas>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderDuplicateCards() {
    const container = document.getElementById("duplicateGrid");
    container.innerHTML = "";
    DUPLICATED_SENSOR_SCHEMAS.forEach(schema => {
        const values = schema.accessor(sensorSnapshot);
        const card = document.createElement("article");
        card.className = "dup-card";
        const boxes = values.map((v, i) => `
            <div class="floor-box">
                <p class="floor-label">${floorLabels[i] ?? `Poziom ${i + 1}`}</p>
                <p class="floor-value">${formatNumber(v)} <span>${schema.unit}</span></p>
                <p class="floor-note">${schema.label}</p>
            </div>
        `).join("");
        card.innerHTML = `
            <header>
                <h3>${schema.label}</h3>
                <span class="status-pill">${values.length} czujniki</span>
            </header>
            <div class="floor-boxes">${boxes}</div>
            <div class="chart-wrapper">
                <canvas id="chart-dup-${schema.id}" class="sensor-chart" aria-label="Wykres ${schema.label}" role="img"></canvas>
            </div>
        `;
        container.appendChild(card);
    });
}

function startClock() {
    const liveClock = document.getElementById("liveClock");
    const tick = () => {
        liveClock.textContent = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };
    tick();
    setInterval(tick, 1000);
}

async function fetchSensorData() {
    const response = await fetch(API_ENDPOINTS.latest, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Błąd pobierania danych (${response.status})`);
    const json = await response.json();
    if (json.status !== "ok" || !Array.isArray(json.data) || json.data.length === 0)
        throw new Error("Nieprawidłowa odpowiedź z API");
    return json.data[0];
}

async function fetchSensorHistory() {
    const response = await fetch(API_ENDPOINTS.history, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Błąd pobierania historii (${response.status})`);
    const json = await response.json();
    if (json.status !== "ok" || !Array.isArray(json.data) || json.data.length === 0)
        throw new Error("Nieprawidłowa historia z API");
    return json.data;
}

function mapPayloadToSnapshot(payload = {}) {
    const fallback = createPlaceholderSnapshot();
    return {
        airQualityIndex: payload.airqualityindex ?? fallback.airQualityIndex,
        envUV: payload.envuv ?? fallback.envUV,
        envLI: payload.envli ?? fallback.envLI,
        envPRES: payload.envpres ?? fallback.envPRES,
        CO2ppm: payload.co2ppm ?? fallback.CO2ppm,
        LUX: payload.lux ?? fallback.LUX,
        CCT: payload.cct ?? fallback.CCT,
        envTEMP: payload.envtemp ?? fallback.envTEMP,
        shelves: [
            { temperature: payload.shttemp ?? fallback.shelves[0].temperature, humidity: payload.shthum ?? fallback.shelves[0].humidity, soil: payload.soilmoisturevalue ?? fallback.shelves[0].soil },
            { temperature: payload.shttemp ?? fallback.shelves[1].temperature, humidity: payload.shthum ?? fallback.shelves[1].humidity, soil: payload.soilmoisturevalue2 ?? fallback.shelves[1].soil },
        ],
        updatedAt: payload.ts ? new Date(payload.ts) : new Date(),
    };
}

function mapHistoryPayloads(collection = []) {
    if (!Array.isArray(collection) || collection.length === 0) return createPlaceholderHistory();
    const mapped = collection.map(mapPayloadToSnapshot);
    return mapped.reverse().slice(-60);
}

async function loadSensorData() {
    try {
        const [latestPayload, historyPayload] = await Promise.all([fetchSensorData(), fetchSensorHistory()]);
        sensorSnapshot = mapPayloadToSnapshot(latestPayload);
        sensorHistory = mapHistoryPayloads(historyPayload);
    } catch (error) {
        console.error("Nie udało się pobrać danych z API. Korzystam z wartości zapasowych.", error);
        sensorSnapshot = createPlaceholderSnapshot();
        sensorHistory = mapHistoryPayloads();
    } finally {
        renderUniqueCards();
        renderDuplicateCards();
        updateTimestamp(sensorSnapshot.updatedAt);
        renderCharts();
    }
}

function updateTimestamp(timestamp = new Date()) {
    const el = document.getElementById("lastUpdated");
    el.textContent = timestamp.toLocaleString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function createPlaceholderSnapshot() {
    return {
        airQualityIndex: 168,
        envUV: 2.1,
        envLI: 12600,
        envPRES: 1008,
        CO2ppm: 742,
        LUX: 9800,
        CCT: 4050,
        envTEMP: 24.1,
        shelves: [
            { temperature: 23.8, humidity: 56, soil: 48 },
            { temperature: 22.9, humidity: 61, soil: 61 },
        ],
        updatedAt: new Date(),
    };
}

function attachEventHandlers() {
    document.getElementById("downloadBtn")?.addEventListener("click", downloadDataset);
}

async function downloadDataset() {
    const button = document.getElementById("downloadBtn");
    if (!button) return;
    button.disabled = true;
    button.textContent = "Generuję...";
    try {
        const response = await fetch(API_ENDPOINTS.export, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Błąd pobierania: ${response.status}`);
        const json = await response.json();
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `astrofarmer-sensors-${new Date().toISOString()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Nie udało się pobrać danych z bazy.", error);
        alert("Nie udało się pobrać danych. Spróbuj ponownie później.");
    } finally {
        button.disabled = false;
        button.textContent = "Pobierz dane";
    }
}

function renderCharts() {
    if (!sensorHistory.length) return;
    renderUniqueCharts();
    renderDuplicateCharts();
}

function renderUniqueCharts() {
    const labels = sensorHistory.map(snap => formatTimeLabel(snap.updatedAt));
    uniqueSensors.forEach(sensor => {
        const canvasEl = document.getElementById(`chart-${sensor.id}`);
        if (!canvasEl) return;
        const dataset = sensorHistory.map(snap => snap[sensor.id]);
        const unitLabel = sensor.unit ? ` (${sensor.unit})` : "";
        upsertChart(`unique-${sensor.id}`, canvasEl, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: `${sensor.label}${unitLabel}`,
                        data: dataset,
                        borderColor: getChartColor(0),
                        backgroundColor: getChartColor(0, 0.2),
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                    },
                ],
            },
        });
    });
}

function renderDuplicateCharts() {
    const labels = sensorHistory.map(snap => formatTimeLabel(snap.updatedAt));
    DUPLICATED_SENSOR_SCHEMAS.forEach(schema => {
        const canvasEl = document.getElementById(`chart-dup-${schema.id}`);
        if (!canvasEl) return;
        const datasetPerFloor = floorLabels.map((floor, idx) => ({
            label: floor,
            data: sensorHistory.map(snap => schema.accessor(snap)[idx] ?? null),
            borderColor: getChartColor(idx),
            backgroundColor: getChartColor(idx, 0.15),
            tension: 0.35,
            pointRadius: 0,
            fill: idx === 0,
        }));
        upsertChart(`dup-${schema.id}`, canvasEl, {
            type: "line",
            data: {
                labels,
                datasets: datasetPerFloor,
            },
        });
    });
}

function upsertChart(key, canvasEl, config) {
    const ctx = canvasEl.getContext("2d");
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { display: true, labels: { color: "#f5f7fb", usePointStyle: true } },
            tooltip: {
                backgroundColor: "rgba(3,7,18,0.85)",
                borderColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                titleColor: "#f5f7fb",
                bodyColor: "#a0accd",
            },
        },
        scales: {
            x: {
                ticks: { color: "#a0accd", maxTicksLimit: 5 },
                grid: { color: "rgba(255,255,255,0.05)" },
            },
            y: {
                ticks: { color: "#a0accd" },
                grid: { color: "rgba(255,255,255,0.05)" },
            },
        },
    };
    const existing = chartRegistry.get(key);
    if (existing) {
        if (existing.canvas !== canvasEl) {
            existing.destroy();
            chartRegistry.delete(key);
        } else {
            existing.data = config.data;
            existing.options = { ...baseOptions, ...(config.options ?? {}) };
            existing.update();
            return;
        }
    }
    const chart = new Chart(ctx, { ...config, options: { ...baseOptions, ...(config.options ?? {}) } });
    chartRegistry.set(key, chart);
}

function formatTimeLabel(date) {
    const d = new Date(date);
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function getChartColor(index = 0, alpha = 1) {
    const palette = [
        `rgba(93, 226, 162, ${alpha})`,
        `rgba(96, 165, 250, ${alpha})`,
        `rgba(249, 115, 22, ${alpha})`,
    ];
    return palette[index % palette.length];
}

function createPlaceholderHistory(count = 12) {
    return Array.from({ length: count }, (_, index) => {
        const snapshot = createPlaceholderSnapshot();
        snapshot.updatedAt = new Date(Date.now() - (count - index) * 60000);
        return snapshot;
    });
}

async function init() {
    startClock();
    attachEventHandlers();
    renderUniqueCards();
    renderDuplicateCards();
    updateTimestamp(sensorSnapshot.updatedAt);
    renderCharts();
    await loadSensorData();
    setInterval(loadSensorData, 300000); // auto-refresh every 5 minutes
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch(error => console.error(error));
});
