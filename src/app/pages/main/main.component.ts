import { Component, OnInit } from '@angular/core';
import { Vital } from 'src/app/vitals/vitals/vital.model';
import { VitalsService } from 'src/app/vitals/vitals/vitals.service';
import { PresetsService } from 'src/app/presets.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  vitals: Vital[] = [];
  // Five predefined slots on the right side. Each can hold a Vital or be null.
  slots: (Vital | null)[] = [null, null, null, null, null];

  constructor(private vitalService: VitalsService, private presets: PresetsService) {}

  ngOnInit(): void {
    this.vitals = this.vitalService.getVitals();
    console.log(this.vitals);
    // subscribe to preset changes
    this.presets.getCurrentIndex$().subscribe(() => {
      const preset = this.presets.getCurrentPreset();
      this.applyPreset(preset);
    });

    // subscribe to save requests from navbar and save current slots as new preset
    this.presets.getSaveRequests$().subscribe(() => {
      this.presets.savePresetFromSlots(this.slots);
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
    }
  }

}
