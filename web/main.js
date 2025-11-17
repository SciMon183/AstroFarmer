const VOC_LEVELS = [
    { max: 100, label: "Doskonałe", action: "Brak działań" },
    { max: 200, label: "Dobre", action: "Monitoruj trend" },
    { max: 300, label: "Lekkie zanieczyszczenie", action: "Przewietrz pomieszczenie" },
    { max: 400, label: "Średnie zanieczyszczenie", action: "Zwiększ wymianę powietrza" },
    { max: 500, label: "Silne zanieczyszczenie", action: "Konieczna optymalizacja wentylacji" },
];

const API_ENDPOINTS = {
    latest: "/api/sensors/latest",
    export: "/api/sensors/export",
};

const floorLabels = ["Piętro 1", "Piętro 2"];

let sensorSnapshot = createPlaceholderSnapshot();

const DUPLICATED_SENSOR_SCHEMAS = [
    {
        id: "temperature",
        label: "Temperatura półek",
        unit: "°C",
        accessor: (snapshot) => snapshot.shelves.map((floor) => floor.temperature),
    },
    {
        id: "humidity",
        label: "Wilgotność względna",
        unit: "%",
        accessor: (snapshot) => snapshot.shelves.map((floor) => floor.humidity),
    },
    {
        id: "soil",
        label: "Wilgotność gleby",
        unit: "%",
        accessor: (snapshot) => snapshot.shelves.map((floor) => floor.soil),
    },
];

const uniqueSensors = [
    {
        id: "airQualityIndex",
        label: "Wskaźnik VOC",
        unit: "indeks",
        meta: (value) => {
            const state = VOC_LEVELS.find((rule) => value <= rule.max) ?? VOC_LEVELS[VOC_LEVELS.length - 1];
            return {
                badge: state.label,
                badgeClass: classifyState(state.label),
                hint: state.action,
            };
        },
    },
    {
        id: "envPRES",
        label: "Ciśnienie",
        unit: "hPa",
        hint: "BMP280",
    },
    {
        id: "CO2ppm",
        label: "CO₂",
        unit: "ppm",
        meta: (value) => ({
            badge: value < 800 ? "Stabilne" : value < 1200 ? "Uwaga" : "Alarm",
            badgeClass: value < 800 ? "" : value < 1200 ? "warn" : "critical",
            hint: value < 800 ? "Optymalny poziom" : "Popraw cyrkulację powietrza",
        }),
    },
    {
        id: "envUV",
        label: "UV",
        unit: "mW/cm²",
        hint: "Czujnik ML8511",
    },
    {
        id: "envLI",
        label: "Natężenie światła",
        unit: "lx",
        hint: "VEML7700",
    },
    {
        id: "LUX",
        label: "Kanał LUX",
        unit: "lx",
        hint: "Spektrometr AS7341",
    },
    {
        id: "CCT",
        label: "CCT",
        unit: "K",
        hint: "Temperatura barwowa",
    },
    {
        id: "envTEMP",
        label: "Temp. otoczenia",
        unit: "°C",
        hint: "Czujnik środowiskowy",
    },
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

    uniqueSensors.forEach((sensor) => {
        const value = sensorSnapshot[sensor.id];
        const meta = sensor.meta?.(value);

        const card = document.createElement("article");
        card.className = "data-card";
        card.innerHTML = `
            <header>
                <h3>${sensor.label}</h3>
                ${meta?.badge ? `<span class="status-pill ${meta.badgeClass ?? ""}">${meta.badge}</span>` : ""}
            </header>
            <p class="sensor-value">
                ${formatNumber(value)}${sensor.unit ? `<span>${sensor.unit}</span>` : ""}
            </p>
            <p class="sensor-meta">${meta?.hint ?? sensor.hint ?? ""}</p>
        `;

        container.appendChild(card);
    });
}

function renderDuplicateCards() {
    const container = document.getElementById("duplicateGrid");
    container.innerHTML = "";

    DUPLICATED_SENSOR_SCHEMAS.forEach((schema) => {
        const values = schema.accessor(sensorSnapshot);
        const card = document.createElement("article");
        card.className = "dup-card";

        const boxes = values
            .map(
                (value, index) => `
            <div class="floor-box">
                <p class="floor-label">${floorLabels[index] ?? `Poziom ${index + 1}`}</p>
                <p class="floor-value">
                    ${formatNumber(value)} <span>${schema.unit}</span>
                </p>
                <p class="floor-note">${schema.label}</p>
            </div>
        `,
            )
            .join("");

        card.innerHTML = `
            <header>
                <h3>${schema.label}</h3>
                <span class="status-pill">${values.length} czujniki</span>
            </header>
            <div class="floor-boxes">
                ${boxes}
            </div>
        `;

        container.appendChild(card);
    });
}

function startClock() {
    const liveClock = document.getElementById("liveClock");

    const tick = () => {
        const now = new Date();
        liveClock.textContent = now.toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    tick();
    setInterval(tick, 1000);
}

async function fetchSensorData() {
    const response = await fetch(API_ENDPOINTS.latest, {
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        throw new Error(`Błąd pobierania danych (${response.status})`);
    }

    return response.json();
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

function mapPayloadToSnapshot(payload = {}) {
    const fallback = createPlaceholderSnapshot();

    return {
        airQualityIndex: payload.airQualityIndex ?? fallback.airQualityIndex,
        envUV: payload.envUV ?? fallback.envUV,
        envLI: payload.envLI ?? fallback.envLI,
        envPRES: payload.envPRES ?? fallback.envPRES,
        CO2ppm: payload.CO2ppm ?? payload.co2Ppm ?? fallback.CO2ppm,
        LUX: payload.LUX ?? payload.lux ?? fallback.LUX,
        CCT: payload.CCT ?? payload.cct ?? fallback.CCT,
        envTEMP: payload.envTEMP ?? payload.temperature ?? fallback.envTEMP,
        shelves: Array.isArray(payload.shelves) && payload.shelves.length
            ? payload.shelves.map((shelf, index) => ({
                  temperature: shelf.temperature ?? fallback.shelves[index]?.temperature ?? 0,
                  humidity: shelf.humidity ?? fallback.shelves[index]?.humidity ?? 0,
                  soil: shelf.soil ?? fallback.shelves[index]?.soil ?? 0,
              }))
            : fallback.shelves,
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
    };
}

async function loadSensorData() {
    try {
        const payload = await fetchSensorData();
        sensorSnapshot = mapPayloadToSnapshot(payload);
    } catch (error) {
        console.error("Nie udało się pobrać danych z API. Korzystam z wartości zapasowych.", error);
        sensorSnapshot = createPlaceholderSnapshot();
    } finally {
        renderUniqueCards();
        renderDuplicateCards();
        updateTimestamp(sensorSnapshot.updatedAt);
    }
}

function updateTimestamp(timestamp = new Date()) {
    const el = document.getElementById("lastUpdated");
    el.textContent = timestamp.toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

async function downloadDataset() {
    const button = document.getElementById("downloadBtn");

    if (!button) return;

    button.disabled = true;
    button.textContent = "Generuję...";

    try {
        const response = await fetch(API_ENDPOINTS.export, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Błąd pobierania: ${response.status}`);

        const blob = await response.blob();
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

function attachEventHandlers() {
    document.getElementById("downloadBtn")?.addEventListener("click", downloadDataset);
}

async function init() {
    startClock();
    attachEventHandlers();
    renderUniqueCards();
    renderDuplicateCards();
    updateTimestamp(sensorSnapshot.updatedAt);
    await loadSensorData();
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => console.error(error));
});

