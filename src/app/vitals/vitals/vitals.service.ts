import { Injectable } from '@angular/core';
import { Vital } from './vital.model';

@Injectable({
  providedIn: 'root'
})
export class VitalsService {

  private initialVitals: Vital[] = [
    { vitalName: 'HR', unit: "bpm", numVal: 72, minVal: 60, maxVal: 100, active: false, color: "#00DA66", category: 'heart' },
    { vitalName: 'ABP', unit: "Sys.", numVal: 120, minVal: 90, maxVal: 140, active: false, color: "#D10000", category: 'heart' },
    { vitalName: 'RR', unit: "rpm", numVal: 16, minVal: 12, maxVal: 20, active: false, color: "#FFF165", category: 'essential' },
    { vitalName: 'SpO2', unit: "%",numVal: 98, minVal: 95, maxVal: 100, active: false, color: "#00B2CF", category: 'essential' },
    { vitalName: 'Temp',unit: "°C", numVal: 37, minVal: 36, maxVal: 39, active: false, color: "#91F741", category: 'essential' },
    { vitalName: 'TCore',unit: "°C", numVal: 98.6, minVal: 97, maxVal: 99, active: false, color: "#91F741", category: 'essential' },
    { vitalName: 'CVP', unit: "",numVal: 9, minVal: 2, maxVal: 8, active: false, color: "#88CBE3", category: 'other' },
    { vitalName: 'ICP', unit: "",numVal: 9, minVal: 2, maxVal: 8, active: false, color: "#FE41C2", category: 'brain' },
    { vitalName: 'PAP', unit: "",numVal: 9, minVal: 2, maxVal: 8, active: false, color: "#FEFE2D", category: 'heart' },
    { vitalName: 'TSkin', unit: "",numVal: 9, minVal: 2, maxVal: 8, active: false, color: "#E77BFE", category: 'other' },
    { vitalName: 'etCO2', unit: "",numVal: 9, minVal: 2, maxVal: 8, active: false, color: "#D9D9D9", category: 'other' },
  ];

  // runtime shallow-cloned list so mutations do not affect the `initialVitals` template
  private vitals: Vital[] = this.initialVitals.map(v => ({ ...v }));


  constructor() { }

  getVitals(): Vital[] {
    // return clones so callers can't mutate internal state
    return this.vitals.map(v => ({ ...v }));
  }

  /**
   * Return the full set of defined vitals (including ones that may be active elsewhere).
   * This is used for the trend/history view which should list all vitals.
   */
  getAllVitals(): Vital[] {
    // return unique vitals by `vitalName` (first occurrence wins)
    // initialVitals is kept in sync with the pinning order
    const seen = new Set<string>();
    const out: Vital[] = [];
    for (const v of this.initialVitals) {
      if (seen.has(v.vitalName)) continue;
      seen.add(v.vitalName);
      out.push({ ...v });
    }
    return out;
  }

  changeVitalOrder(vitalName: string, newIndex: number): void {
    const currentIndex = this.vitals.findIndex(v => v.vitalName === vitalName);
    if (currentIndex === -1 || newIndex < 0 || newIndex >= this.vitals.length) {
      return;
    }
    const [vital] = this.vitals.splice(currentIndex, 1);
    this.vitals.splice(newIndex, 0, vital);
    this.vitals = [...this.vitals];
    
    // Also update initialVitals order to keep them in sync
    const initialIndex = this.initialVitals.findIndex(v => v.vitalName === vitalName);
    if (initialIndex !== -1) {
      const [initialVital] = this.initialVitals.splice(initialIndex, 1);
      this.initialVitals.splice(newIndex, 0, initialVital);
    }
  }

  /** Reset to original default vitals */
  resetToDefaults(): void {
    // recreate fresh clones from the initial template
    this.vitals = this.initialVitals.map(v => ({ ...v }));
  }

  /**
   * Remove a vital from the internal list and return it.
   * This physically removes it from the left selector.
   */
  removeVital(vitalName: string): Vital | undefined {
    const idx = this.vitals.findIndex(v => v.vitalName === vitalName);
    if (idx === -1) return undefined;
    const [removed] = this.vitals.splice(idx, 1);
    // mark removed as active (internal object) and return a clone to callers
    removed.active = true;
    return { ...removed };
  }

  /**
   * Add a vital back into the internal list (marking it inactive).
   */
  addVital(vital: Vital): void {
    const clone = { ...vital, active: false };
    // add to the end of the list
    this.vitals.push(clone);
  }

  setVitalActive(vitalName: string): void {
    // Mark the named vital active without deactivating others.
    this.vitals.forEach(vital => {
      if (vital.vitalName === vitalName) {
        vital.active = true;
      }
    });
  }

  setVitalInactive(vitalName: string): void {
    this.vitals.forEach(vital => {
      if (vital.vitalName === vitalName) {
        vital.active = false;
      }
    });
  }
}