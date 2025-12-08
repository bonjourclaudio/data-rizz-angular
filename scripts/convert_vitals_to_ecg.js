const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "assets", "data");
const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

for (const f of files) {
  const p = path.join(dataDir, f);
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    // if already in fetch.signal format, skip
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.fetch
    ) {
      console.log(`Skipping ${f} (already ECG-style)`);
      continue;
    }
    // if array of {timestamp,value}
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed[0].value !== undefined
    ) {
      const samp = parsed.map((it) => Number(it.value));
      const firstTs = Number(parsed[0].timestamp) || 0;
      const lastTs =
        Number(parsed[parsed.length - 1].timestamp) ||
        firstTs + parsed.length - 1;
      const tps = 1; // assume 1Hz for these vitals
      const out = {
        fetch: {
          signal: [
            {
              name: path.basename(f, ".json"),
              units: "",
              t0: firstTs,
              tf: lastTs,
              tps,
              samp,
            },
          ],
        },
      };
      fs.writeFileSync(p, JSON.stringify(out, null, 2));
      console.log(`Converted ${f} -> ECG-style (samples: ${samp.length})`);
    } else {
      console.log(`Skipping ${f} (unknown format)`);
    }
  } catch (err) {
    console.error(`Error processing ${f}:`, err.message);
  }
}
