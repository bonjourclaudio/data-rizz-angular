#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "assets", "data");
const intervalMs = 1000; // update every second

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomDelta(maxStep = 1) {
  // integer step between -maxStep and +maxStep
  return Math.floor(Math.random() * (maxStep * 2 + 1)) - maxStep;
}

function updateFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return;

    // compute sensible bounds from existing values
    const values = arr.map((p) => Number(p.value) || 0);
    const minVal = Math.floor(Math.min(...values) - 5);
    const maxVal = Math.ceil(Math.max(...values) + 5);

    const last = arr[arr.length - 1];
    const nextTs = (Number(last.timestamp) || 0) + 1;
    // next value: last +/- 0..1 (rounded)
    const delta = randomDelta(1);
    const nextVal = clamp(
      Math.round(Number(last.value) + delta),
      minVal,
      maxVal
    );

    // rotate: drop first, push new
    arr.shift();
    arr.push({ timestamp: nextTs, value: nextVal });

    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.error("updateFile error", filePath, err.message);
  }
}

function start() {
  if (!fs.existsSync(dataDir)) {
    console.error("data dir not found:", dataDir);
    process.exit(1);
  }
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("no json files in", dataDir);
    process.exit(1);
  }

  console.log(
    "Starting simulator: updating",
    files.length,
    "files every",
    intervalMs,
    "ms"
  );

  const timer = setInterval(() => {
    for (const f of files) {
      updateFile(path.join(dataDir, f));
    }
  }, intervalMs);

  function stop() {
    clearInterval(timer);
    console.log("Simulator stopped");
    process.exit(0);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

start();
