const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "src", "assets", "data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const vitals = [
  { name: "ABP", min: 90, max: 160 },
  { name: "SpO2", min: 90, max: 160 },
  { name: "HR", min: 59, max: 120 },
  { name: "RR", min: 15, max: 30 },
  { name: "ICP", min: 0, max: 10 },
  { name: "etCO2", min: 30, max: 50 },
  { name: "PAP", min: 0, max: 16 },
];

const count = 60; // 1 minute @ 1Hz
const now = Math.floor(Date.now() / 1000);
const startTs = now - count;

function generateSeries(min, max) {
  const out = [];
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  for (let i = 0; i < count; i++) {
    const t = startTs + i;
    // smooth periodic variation
    const base = mid + amp * Math.sin(i * 0.08);
    // small random jitter
    const jitter = (Math.random() - 0.5) * (max - min) * 0.06;
    let v = base + jitter;
    // occasional spikes outside range to trigger warnings
    if (i % 60 === 0) {
      // spike above max
      v = max + Math.abs(Math.random() * (max - min) * 0.2 + 1);
    }
    if (i % 73 === 0) {
      // dip below min
      v = min - Math.abs(Math.random() * (max - min) * 0.2 + 1);
    }
    // clamp to some reasonable precision
    if (Number.isInteger(min) && Number.isInteger(max)) v = Math.round(v);
    else v = Math.round(v * 10) / 10;
    out.push({ timestamp: t, value: v });
  }
  return out;
}

for (const v of vitals) {
  const series = generateSeries(v.min, v.max);
  const filename = path.join(outDir, `${v.name}.json`);
  fs.writeFileSync(filename, JSON.stringify(series, null, 2));
  console.log(
    `Wrote ${filename} (${series.length} samples, range ${v.min}-${v.max})`
  );
}

console.log("Done.");
