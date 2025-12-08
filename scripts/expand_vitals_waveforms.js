const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "assets", "data");
const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

// sampling rates per vital (Hz)
const rates = {
  ABP: 50,
  SpO2: 10,
  HR: 25,
  RR: 10,
  ICP: 20,
  etCO2: 10,
  PAP: 20,
  TCore: 1,
  CVP: 10,
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

for (const f of files) {
  const p = path.join(dataDir, f);
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    // skip if already converted
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.fetch
    ) {
      console.log(`Skipping ${f} (already converted)`);
      continue;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log(`Skipping ${f} (not an array)`);
      continue;
    }

    const name = path.basename(f, ".json");
    const vals = parsed.map((it) => ({
      t: Number(it.timestamp),
      v: Number(it.value),
    }));
    const t0 = vals[0].t;
    const tf = vals[vals.length - 1].t;
    const durationSec = Math.max(1, tf - t0 + 1);
    const tps = rates[name] || 10;
    const totalSamples = Math.max(1, Math.floor(durationSec * tps));

    // build interpolated samples at high rate
    const samp = [];
    for (let i = 0; i < totalSamples; i++) {
      const tt = t0 + i / tps; // absolute time
      // find surrounding original samples
      let left = vals[0];
      let right = vals[vals.length - 1];
      for (let k = 0; k < vals.length - 1; k++) {
        if (tt >= vals[k].t && tt <= vals[k + 1].t) {
          left = vals[k];
          right = vals[k + 1];
          break;
        }
      }
      const span = right.t - left.t || 1;
      const frac = (tt - left.t) / span;
      let v = lerp(left.v, right.v, frac);
      // add small physiologic waveform variations: a tiny high-frequency sine + noise
      // amplitude relative to range
      const range =
        Math.abs(Math.max(left.v, right.v) - Math.min(left.v, right.v)) ||
        Math.abs(left.v) ||
        1;
      const hf = Math.sin(i * 0.2 * Math.PI) * (range * 0.02); // low amplitude oscillation
      const jitter = (Math.random() - 0.5) * (range * 0.01);
      v = v + hf + jitter;
      // for pressures and HR keep integers
      if (Number.isInteger(left.v) && Number.isInteger(right.v))
        v = Math.round(v);
      else v = Math.round(v * 1000) / 1000;
      samp.push(v);
    }

    const out = {
      fetch: {
        signal: [
          {
            name,
            units: "",
            t0: t0,
            tf: tf,
            tps: tps,
            samp,
          },
        ],
      },
    };

    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(
      `Converted ${f}: ${vals.length} -> ${samp.length} samples @${tps}Hz`
    );
  } catch (err) {
    console.error(`Error converting ${f}:`, err.message);
  }
}
