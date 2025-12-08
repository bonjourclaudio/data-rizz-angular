import { Component, OnInit, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Vital } from 'src/app/vitals/vitals/vital.model';
import { VitalsService } from 'src/app/vitals/vitals/vitals.service';
import { PresetsService } from 'src/app/presets.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainComponent implements OnInit {

  vitals: Vital[] = [];
  // full list used for trend rows (should show all vitals regardless of active state)
  trendVitals: Vital[] = [];
  // expose Math to the template because templates can't access global Math directly
  readonly Math = Math;
  // Five predefined slots on the right side. Each can hold a Vital or be null.
  slots: (Vital | null)[] = [null, null, null, null, null];
  // Trend/history controls
  trendWindowSeconds = 60 * 5; // visible window (seconds) default 5 minutes
  trendOffsetSeconds = 0; // how far back from 'now' the right edge is
  // center line percentage position in timeline (0..100)
  timelineCenterPercent = 100;
  // latest value per vital as provided by historical graphs
  trendValues: { [vitalName: string]: number } = {};
  // value at the center timestamp of the viewed history window
  trendCenterValues: { [vitalName: string]: number | null } = {};

  constructor(private vitalService: VitalsService, private presets: PresetsService, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.vitals = this.vitalService.getVitals();
    this.trendVitals = this.vitalService.getAllVitals();
    console.log(this.vitals);
    this.updateTimelineCenter();
    // subscribe to preset changes
    this.presets.getCurrentIndex$().subscribe(() => {
      const preset = this.presets.getCurrentPreset();
      this.applyPreset(preset);
    });

    // subscribe to save requests from navbar and save current slots as new preset
    this.presets.getSaveRequests$().subscribe(() => {
      this.presets.savePresetFromSlots(this.slots);
    });

    // Listen for arrow key presses outside Angular zone to avoid change detection issues
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.ngZone.run(() => this.shiftTrend(60));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.ngZone.run(() => this.shiftTrend(-60));
        }
      });
    });
  }

  filterActiveVitals(vital: Vital): boolean {
    return !vital.active;
  }

  onDragStart(event: DragEvent, vitalName: string): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', vitalName);
  }

  applyPreset(preset: { name: string; slots: (string | null)[] }) {
    if (!preset) return;
    // reset vitals to defaults so we can remove assigned ones
    this.vitalService.resetToDefaults();
    // clear slots
    this.slots = [null, null, null, null, null];

    for (let i = 0; i < Math.min(5, preset.slots.length); i++) {
      const name = preset.slots[i];
      if (name) {
        const removed = this.vitalService.removeVital(name);
        if (removed) {
          this.slots[i] = removed;
        }
      }
    }

    // refresh local list reference for template
    this.vitals = [...this.vitalService.getVitals()];

    // applying a preset clears any unsaved changes
    this.presets.clearDirty();
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const vitalName = event.dataTransfer.getData('text/plain');
    if (!vitalName) return;

    // Remove the dropped vital from the service list so it disappears from the left selector
    const removed = this.vitalService.removeVital(vitalName);
    if (!removed) {
      // If it wasn't in the service list, it might already be active in another slot.
      // Try finding it in our local vitals array (could be absent) or create a minimal object.
      const existing = this.vitals.find(v => v.vitalName === vitalName);
      if (existing) {
        this.slots[slotIndex] = existing;
      }
      return;
    }

    // Save previous content of this slot (if any)
    const previous = this.slots[slotIndex];

    // Clear the vital from any other slot (if it was active elsewhere)
    for (let i = 0; i < this.slots.length; i++) {
      if (i !== slotIndex && this.slots[i] && this.slots[i]!.vitalName === removed.vitalName) {
        this.slots[i] = null;
      }
    }

    // If there is an existing vital in this slot, add it back to the service list
    if (previous && previous.vitalName !== removed.vitalName) {
      this.vitalService.addVital(previous);
    }

    // assign removed vital to slot
    this.slots[slotIndex] = removed;

    // Refresh local reference so the template re-renders the compacted list
    this.vitals = [...this.vitalService.getVitals()];

    // mark layout as changed so navbar shows "New Preset *"
    this.presets.markDirty();
  }

  // update slot numeric value when child emits graph readings
  onSlotValueChange(value: number, slotIndex: number) {
    if (this.slots[slotIndex]) {
      // sanitize incoming value: integer and non-negative
      let v = Number(value);
      if (isNaN(v)) v = 0;
      v = Math.round(v);
      v = Math.max(0, v);
      this.slots[slotIndex] = { ...this.slots[slotIndex]!, numVal: v };
      this.cdr.markForCheck();
    }
  }

  // Trend controls
  setTrendRange(minutes: number) {
    const oldWindow = this.trendWindowSeconds;
    const newWindow = Math.max(1, Math.round(minutes * 60));
    
    // Scale the offset proportionally to maintain relative position
    // If we're at 50% through a 5min window and switch to 30min,
    // we should be at 50% through the 30min window
    if (oldWindow > 0) {
      const relativePosition = this.trendOffsetSeconds / oldWindow;
      this.trendOffsetSeconds = Math.round(relativePosition * newWindow);
    }
    
    this.trendWindowSeconds = newWindow;
    this.trendOffsetSeconds = Math.max(0, this.trendOffsetSeconds);
    this.updateTimelineCenter();
  }

  shiftTrend(seconds: number) {
    this.trendOffsetSeconds = Math.max(0, this.trendOffsetSeconds + seconds);
    this.updateTimelineCenter();
    this.cdr.markForCheck();
  }

  jumpToNow() {
    this.trendOffsetSeconds = 0;
    this.updateTimelineCenter();
    this.cdr.markForCheck();
  }

  updateTimelineCenter() {
    const pct = 1 - (this.trendOffsetSeconds / Math.max(1, this.trendWindowSeconds));
    this.timelineCenterPercent = Math.max(0, Math.min(100, pct * 100));
  }

  formatOffsetLabel(sec: number) {
    const s = Math.abs(Math.round(sec));
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    const sign = sec < 0 ? '-' : '';
    return `${sign}${h}:${m}:${ss}`;
  }

  // helper for templates to safely return the centered historical value or a fallback
  getTrendCenterValue(vitalName: string, fallback: number): number {
    const v = this.trendCenterValues[vitalName];
    if (v === undefined || v === null || isNaN(v as any)) return fallback;
    return v as number;
  }

  onTrendValueChange(vitalName: string, value: number): void {
    this.trendValues[vitalName] = value;
    this.cdr.markForCheck();
  }

  onTrendCenterValueChange(vitalName: string, value: number): void {
    this.trendCenterValues[vitalName] = value;
    this.cdr.markForCheck();
  }

}
