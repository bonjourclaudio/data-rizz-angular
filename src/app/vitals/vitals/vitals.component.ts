import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveDataService } from './live-data.service';
import { LogService } from 'src/app/log.service';

@Component({
  selector: 'app-vitals',
  templateUrl: './vitals.component.html',
  styleUrls: ['./vitals.component.scss'],
})
export class VitalsComponent implements OnChanges, OnDestroy {
  @Input() vitalName: string | undefined = '';
  @Input() unit: string = '';
  @Input() numVal: number | undefined = 0;
  @Input() minVal: number = 0;
  @Input() maxVal: number = 0;
  @Input() active: boolean = false;
  @Input() size: string = '';
  @Input() color: string | undefined = '';
  // when false, do not subscribe to LiveDataService updates (useful for historical/static display)
  @Input() subscribeLive: boolean = true;
  // when true, suppress rendering the embedded graph inside the component
  @Input() noGraph: boolean = false;
  @Output() valueChange: EventEmitter<number> = new EventEmitter<number>();

  // selector state for min/max adjustments
  @ViewChild('selectorOverlay', { static: false })
  selectorOverlay: ElementRef | null = null;
  selectorVisible: boolean = false;
  selectorTarget: 'min' | 'max' | null = null;
  // the currently highlighted/center value in the selector while scrolling
  selectorCurrentValue: number = 0;
  // internal temporary value while selecting
  selectorTempValue: number = 0;
  // inline style for selector position
  selectorStyle: { [k: string]: any } = {};

  // pointer/inertia state
  private pointerActive: boolean = false;
  private lastPointerY: number = 0;
  private lastPointerTime: number = 0;
  private velocityValue: number = 0; // measured in 'value units' per RAF frame
  private inertiaFrame: any = null;

  private liveSub: Subscription | null = null;
  private warnSub: Subscription | null = null;
  warningActive: boolean = false;

  constructor(private live: LiveDataService, private log: LogService) {
    // subscribe to recent warnings and toggle a local warning flag when this vital is reported
    this.warnSub = this.log.getRecentWarning$().subscribe((entry) => {
      try {
        if (!entry || !this.vitalName) return;
        if (entry.vitalName === this.vitalName) {
          this.warningActive = true;
          // turn off after 5s
          setTimeout(() => {
            this.warningActive = false;
          }, 5000);
        }
      } catch (err) {}
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vitalName']) {
      if (this.subscribeLive) this.subscribeToLive();
    }
    // if active flag changes, we may want to emit latest value to parent
    if (changes['active'] && this.active && this.numVal !== undefined) {
      // notify parent that the graph (or service) has a current value
      this.valueChange.emit(this.numVal as number);
    }
  }

  ngOnDestroy(): void {
    if (this.liveSub) {
      this.liveSub.unsubscribe();
      this.liveSub = null;
    }
    if (this.warnSub) {
      this.warnSub.unsubscribe();
      this.warnSub = null;
    }
  }

  // open selector for min or max (simple call)
  openSelector(which: 'min' | 'max') {
    this.openSelectorAt(which, null);
  }

  // open selector and optionally position it near an event target
  openSelectorAt(
    which: 'min' | 'max',
    event: MouseEvent | PointerEvent | null
  ) {
    this.selectorTarget = which;
    this.selectorVisible = true;
    // initialize selector value to current min/max (fallback to numVal or 0)
    const start = which === 'min' ? this.minVal : this.maxVal;
    this.selectorCurrentValue =
      start !== undefined ? Number(start) : this.numVal || 0;
    // initialize temp value while respecting cross-constraints for the chosen target
    this.selectorTempValue = this.clampToVitalRange(
      this.selectorCurrentValue,
      which
    );

    // compute position near event target if provided. choose left or right depending on available space
    const selectorWidth = 90;
    const selectorHeight = 220;
    if (event && (event as PointerEvent).clientX !== undefined) {
      try {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        // prefer placing to the right, but if not enough space, place to the left
        let leftPx: number;
        if (rect.right + 6 + selectorWidth <= vw) {
          leftPx = Math.max(6, Math.round(rect.right + 6));
        } else if (rect.left - 6 - selectorWidth >= 0) {
          leftPx = Math.max(6, Math.round(rect.left - 6 - selectorWidth));
        } else {
          leftPx = Math.max(6, Math.round((vw - selectorWidth) / 2));
        }
        let topPx = Math.round(rect.top + rect.height / 2 - selectorHeight / 2);
        topPx = Math.max(6, Math.min(vh - selectorHeight - 6, topPx));
        this.selectorStyle = {
          position: 'fixed',
          left: `${leftPx}px`,
          top: `${topPx}px`,
        };
      } catch (e) {
        this.selectorStyle = {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        };
      }
    } else {
      // default centered
      this.selectorStyle = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // focus so wheel events are captured
    setTimeout(() => {
      try {
        (this.selectorOverlay as any)?.nativeElement?.focus();
      } catch (e) {}
    }, 0);
  }

  // commit selection when clicking on number or clicking away
  commitSelector() {
    if (!this.selectorVisible || !this.selectorTarget) return;
    const v = this.clampToVitalRange(
      Math.round(this.selectorTempValue),
      this.selectorTarget
    );
    if (this.selectorTarget === 'min') {
      this.minVal = v;
    } else {
      this.maxVal = v;
    }
    // hide selector
    this.stopInertia();
    this.selectorVisible = false;
    this.selectorTarget = null;
  }

  // cancel selector without committing
  cancelSelector() {
    this.selectorVisible = false;
    this.selectorTarget = null;
    // revert temporary selection
    this.selectorTempValue = this.selectorCurrentValue;
  }

  // handle wheel events when selector has focus: deltaY controls the value
  onSelectorWheel(event: WheelEvent) {
    event.preventDefault();
    // choose a sensible step based on delta
    // small wheel delta -> 1 step, large -> 5 steps
    const step = Math.abs(event.deltaY) > 50 ? 5 : 1;
    const delta = Math.sign(event.deltaY) * step;
    this.selectorTempValue = this.selectorTempValue - delta;
    // clamp to per-vital range and cross-constraints
    this.selectorTempValue = this.clampToVitalRange(
      Math.round(this.selectorTempValue),
      this.selectorTarget
    );
    // update live value
    if (this.selectorTarget === 'min') {
      this.minVal = this.selectorTempValue;
    } else if (this.selectorTarget === 'max') {
      this.maxVal = this.selectorTempValue;
    }
    // cancel any running inertia
    this.stopInertia();
  }

  // clamp a value to per-vital allowed range
  private clampToVitalRange(
    v: number,
    target: 'min' | 'max' | null = null
  ): number {
    const r = this.getVitalRange(this.vitalName || '');
    let allowedMin = r.min;
    let allowedMax = r.max;
    // cross-constraints: when adjusting max, its minimum is the current minVal
    // and when adjusting min, its maximum is the current maxVal
    const curMin = typeof this.minVal === 'number' ? this.minVal : allowedMin;
    const curMax = typeof this.maxVal === 'number' ? this.maxVal : allowedMax;
    if (target === 'max') {
      allowedMin = Math.max(allowedMin, curMin);
    }
    if (target === 'min') {
      allowedMax = Math.min(allowedMax, curMax);
    }
    const rounded = Math.round(v);
    return Math.max(allowedMin, Math.min(allowedMax, rounded));
  }

  // return the allowed numeric range for the current selector target (respecting per-vital and cross-constraints)
  getAllowedRange(target: 'min' | 'max' | null = null): {
    min: number;
    max: number;
  } {
    const r = this.getVitalRange(this.vitalName || '');
    let allowedMin = r.min;
    let allowedMax = r.max;
    const curMin = typeof this.minVal === 'number' ? this.minVal : allowedMin;
    const curMax = typeof this.maxVal === 'number' ? this.maxVal : allowedMax;
    if (target === 'max') {
      allowedMin = Math.max(allowedMin, curMin);
    }
    if (target === 'min') {
      allowedMax = Math.min(allowedMax, curMax);
    }
    return { min: allowedMin, max: allowedMax };
  }

  // whether a particular numeric value is allowed for the current selector target
  isAllowed(v: number): boolean {
    const rng = this.getAllowedRange(this.selectorTarget);
    return v >= rng.min && v <= rng.max;
  }

  // simple per-vital ranges (defaults). Adjust these as needed for domain accuracy.
  private getVitalRange(name: string): { min: number; max: number } {
    const n = (name || '').toLowerCase();
    if (n.includes('hr')) return { min: 0, max: 300 };
    if (n.includes('spo2')) return { min: 0, max: 100 };
    if (n.includes('abp')) return { min: 0, max: 300 };
    if (n.includes('rr')) return { min: 0, max: 60 };
    if (n.includes('etco2')) return { min: 0, max: 150 };
    if (n.includes('icp')) return { min: 0, max: 60 };
    if (n.includes('pap')) return { min: 0, max: 200 };
    if (n.includes('cvp')) return { min: -10, max: 50 };
    if (n.includes('tcore') || n.includes('temp')) return { min: 20, max: 45 };
    // fallback
    return { min: 0, max: 1000 };
  }

  // pointer-based dragging for smooth/inertial scrolling
  onPointerDown(event: PointerEvent) {
    if (!this.selectorVisible) return;
    (event.target as Element).setPointerCapture(event.pointerId);
    this.pointerActive = true;
    this.lastPointerY = event.clientY;
    this.lastPointerTime = performance.now();
    this.velocityValue = 0;
    this.stopInertia();
    // add listeners on window for move/up
  }

  onPointerMove(event: PointerEvent) {
    if (!this.pointerActive) return;
    const now = performance.now();
    const dy = this.lastPointerY - event.clientY; // drag up -> positive
    const dt = Math.max(1, now - this.lastPointerTime);
    const pixelsPerStep = 6; // how many px correspond to one unit
    const deltaValue = dy / pixelsPerStep;
    this.selectorTempValue = this.selectorTempValue + deltaValue;
    // clamp with cross-constraint awareness
    this.selectorTempValue = this.clampToVitalRange(
      Math.round(this.selectorTempValue),
      this.selectorTarget
    );
    // update live
    if (this.selectorTarget === 'min') this.minVal = this.selectorTempValue;
    else this.maxVal = this.selectorTempValue;
    // velocity measured in value units per frame (approx)
    this.velocityValue = (deltaValue / dt) * 16; // normalize to ~16ms frame
    this.lastPointerY = event.clientY;
    this.lastPointerTime = now;
  }

  onPointerUp(event: PointerEvent) {
    if (!this.pointerActive) return;
    try {
      (event.target as Element).releasePointerCapture(event.pointerId);
    } catch (e) {}
    this.pointerActive = false;
    // start inertia animation using velocityValue
    this.startInertia();
  }

  private startInertia() {
    if (this.inertiaFrame) cancelAnimationFrame(this.inertiaFrame);
    const step = () => {
      // apply decay
      this.velocityValue *= 0.95;
      if (Math.abs(this.velocityValue) < 0.01) {
        this.velocityValue = 0;
        this.stopInertia();
        return;
      }
      this.selectorTempValue = this.selectorTempValue + this.velocityValue;
      this.selectorTempValue = this.clampToVitalRange(
        Math.round(this.selectorTempValue),
        this.selectorTarget
      );
      if (this.selectorTarget === 'min') this.minVal = this.selectorTempValue;
      else this.maxVal = this.selectorTempValue;
      this.inertiaFrame = requestAnimationFrame(step);
    };
    this.inertiaFrame = requestAnimationFrame(step);
  }

  private stopInertia() {
    if (this.inertiaFrame) {
      cancelAnimationFrame(this.inertiaFrame);
      this.inertiaFrame = null;
    }
    this.velocityValue = 0;
  }

  // allow keyboard arrows while selector open
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!this.selectorVisible) return;
    if (event.key === 'ArrowUp') {
      this.selectorTempValue = Math.max(0, this.selectorTempValue + 1);
      if (this.selectorTarget === 'min') this.minVal = this.selectorTempValue;
      else this.maxVal = this.selectorTempValue;
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.selectorTempValue = Math.max(0, this.selectorTempValue - 1);
      if (this.selectorTarget === 'min') this.minVal = this.selectorTempValue;
      else this.maxVal = this.selectorTempValue;
      event.preventDefault();
    } else if (event.key === 'Enter') {
      this.commitSelector();
      event.preventDefault();
    } else if (event.key === 'Escape') {
      this.cancelSelector();
      event.preventDefault();
    }
  }

  private subscribeToLive(): void {
    if (this.liveSub) {
      this.liveSub.unsubscribe();
      this.liveSub = null;
    }
    if (!this.vitalName) return;
    try {
      this.liveSub = this.live.getValue$(this.vitalName).subscribe((val) => {
        if (isNaN(val)) return;
        let v = Number(val);
        if (isNaN(v)) v = 0;
        v = Math.round(v);
        v = Math.max(0, v);
        this.numVal = v;
        // only emit to parent when this component is active (parent expects valueChange for active slots)
        if (this.active) {
          this.valueChange.emit(v);
        }
      });
    } catch (err) {
      // ignore missing file or service errors
    }
  }

  onGraphValue(val: number) {
    let v = Number(val);
    if (isNaN(v)) v = 0;
    v = Math.round(v);
    v = Math.max(0, v);
    this.numVal = v;
    this.valueChange.emit(v);
  }
}
