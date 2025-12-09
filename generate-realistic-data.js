const fs = require("fs");
const path = require("path");

// Vital definitions with realistic ranges and sampling rates
const vitals = [
  {
    name: "ABP",
    tps: 50,
    min: 90,
    max: 140,
    normal: 120,
    variation: 15,
    unit: "Sys.",
  },
  {
    name: "HR",
    tps: 25,
    min: 60,
    max: 100,
    normal: 72,
    variation: 5,
    unit: "bpm",
  },
  {
    name: "RR",
    tps: 10,
    min: 12,
    max: 20,
    normal: 16,
    variation: 2,
    unit: "rpm",
  },
  {
    name: "SpO2",
    tps: 10,
    min: 95,
    max: 100,
    normal: 98,
    variation: 1,
    unit: "%",
  },
  {
    name: "TCore",
    tps: 1,
    min: 97,
    max: 99,
    normal: 98.6,
    variation: 0.5,
    unit: "°C",
  },
  {
    name: "CVP",
    tps: 10,
    min: 2,
    max: 8,
    normal: 5,
    variation: 1.5,
    unit: "mmHg",
  },
  {
    name: "ICP",
    tps: 10,
    min: 2,
    max: 8,
    normal: 5,
    variation: 1.5,
    unit: "mmHg",
  },
  {
    name: "PAP",
    tps: 10,
    min: 2,
    max: 8,
    normal: 5,
    variation: 1.5,
    unit: "mmHg",
  },
  {
    name: "TSkin",
    tps: 2,
    min: 32,
    max: 35,
    normal: 34,
    variation: 0.8,
    unit: "°C",
  },
  {
    name: "etCO2",
    tps: 10,
    min: 35,
    max: 45,
    normal: 40,
    variation: 2,
    unit: "mmHg",
  },
];

// Generate smooth, loopable waveform with occasional excursions
function generateWaveform(vital, durationSeconds = 300) {
  const { tps, min, max, normal, variation } = vital;
  const totalSamples = durationSeconds * tps;
  const samples = [];
  const range = max - min;

  // Excursion points: ~30 sec and ~90 sec (dividing 5 min into thirds)
  const excursionPoints = [
    Math.floor(durationSeconds * 0.33 * tps),
    Math.floor(durationSeconds * 0.67 * tps),
  ];
  const excursionDuration = Math.floor(tps * 6); // 6 second excursion window

  for (let i = 0; i < totalSamples; i++) {
    // Base sine wave for natural oscillation
    const baseValue = normal + variation * Math.sin(i / (tps * 4));

    // Add smooth random noise
    const noise = (Math.random() - 0.5) * variation * 0.3;

    let value = baseValue + noise;

    // Check if we're in an excursion window
    let inExcursion = false;
    for (let ep = 0; ep < excursionPoints.length; ep++) {
      const excStart = excursionPoints[ep];
      const excEnd = excStart + excursionDuration;

      if (i > excStart && i < excEnd) {
        inExcursion = true;
        const progress = (i - excStart) / excursionDuration;

        // Create smooth bell curve excursion
        const amplitude = range * 1.3 * Math.sin(progress * Math.PI);

        if (ep % 2 === 0) {
          // Go above max
          value = max + amplitude;
        } else {
          // Go below min
          value = min - amplitude;
        }
      }
    }

    // Clamp normal range values
    if (!inExcursion) {
      value = Math.max(min, Math.min(max, value));
    }

    // Ensure no zero or very small values
    if (value < Math.max(0.5, min * 0.3)) {
      value = min + variation * 0.5;
    }

    // Round appropriately based on vital type
    if (vital.name === "TCore" || vital.name === "TSkin") {
      value = Math.round(value * 10) / 10;
    } else {
      value = Math.round(value);
    }

    samples.push(value);
  }

  return samples;
}

// Generate and save data files
vitals.forEach((vital) => {
  const samples = generateWaveform(vital);
  const data = {
    fetch: {
      signal: [
        {
          name: vital.name,
          units: vital.unit,
          t0: 1704067200,
          tf: 1704067200 + 300,
          tps: vital.tps,
          samp: samples,
        },
      ],
    },
  };

  const filePath = path.join(
    __dirname,
    "src",
    "assets",
    "data",
    `${vital.name}.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Generated ${vital.name}.json with ${samples.length} samples`);
});

console.log("\nAll data files generated successfully!");
console.log("Out-of-range excursions at ~30 sec and ~90 sec for each vital");
