const VOC_LEVELS = [
    { max: 100, label: "Doskonałe", action: "Brak działań" },
    { max: 200, label: "Dobre", action: "Monitoruj trend" },
    { max: 300, label: "Lekkie zanieczyszczenie", action: "Przewietrz pomieszczenie" },
    { max: 400, label: "Średnie zanieczyszczenie", action: "Zwiększ wymianę powietrza" },
    { max: 500, label: "Silne zanieczyszczenie", action: "Konieczna optymalizacja wentylacji" },
];

const sensorSnapshot = {
    airQualityIndex: 168,
    envUV: 2.1, // mW/cm2
    envLI: 12600, // lux
    envPRES: 1008, // hPa
    CO2ppm: 742,
    LUX: 9800,
    CCT: 4050,
    colorPoint: { x: 0.32, y: 0.34 },
    uniqueHumidity: 58,
    envTEMP: 24.1,
    soilMoisture: [48, 61],
    shelves: [
        { temperature: 23.8, humidity: 56, soil: 48 },
        { temperature: 22.9, humidity: 61, soil: 61 },
    ],
    updatedAt: new Date(),
};

const floorLabels = ["Piętro 1", "Piętro 2"];

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

const duplicatedSensors = [
    {
        id: "temperature",
        label: "Temperatura półek",
        unit: "°C",
        values: sensorSnapshot.shelves.map((floor) => floor.temperature),
    },
    {
        id: "humidity",
        label: "Wilgotność względna",
        unit: "%",
        values: sensorSnapshot.shelves.map((floor) => floor.humidity),
    },
    {
        id: "soil",
        label: "Wilgotność gleby",
        unit: "%",
        values: sensorSnapshot.shelves.map((floor) => floor.soil),
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

    duplicatedSensors.forEach((sensor) => {
        const card = document.createElement("article");
        card.className = "dup-card";

        const boxes = sensor.values
            .map(
                (value, index) => `
            <div class="floor-box">
                <p class="floor-label">${floorLabels[index] ?? `Poziom ${index + 1}`}</p>
                <p class="floor-value">
                    ${formatNumber(value)} <span>${sensor.unit}</span>
                </p>
                <p class="floor-note">${sensor.label}</p>
            </div>
        `,
            )
            .join("");

        card.innerHTML = `
            <header>
                <h3>${sensor.label}</h3>
                <span class="status-pill">${sensor.values.length} czujniki</span>
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

function updateTimestamp() {
    const el = document.getElementById("lastUpdated");
    el.textContent = sensorSnapshot.updatedAt.toLocaleString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function init() {
    renderUniqueCards();
    renderDuplicateCards();
    startClock();
    updateTimestamp();
}

document.addEventListener("DOMContentLoaded", init);

