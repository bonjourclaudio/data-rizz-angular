import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveDataService } from './live-data.service';
import { LogService } from 'src/app/log.service';

@Component({
  selector: 'app-vitals',
  templateUrl: './vitals.component.html',
  styleUrls: ['./vitals.component.scss']
})
export class VitalsComponent implements OnChanges, OnDestroy {
  @Input() vitalName: string | undefined = "";
  @Input() unit: string = "";
  @Input() numVal: number | undefined = 0;
  @Input() minVal: number = 0;
  @Input() maxVal: number = 0;
  @Input() active: boolean = false;
  @Input() size: string = "";
  @Input() color: string | undefined = "";
  // when false, do not subscribe to LiveDataService updates (useful for historical/static display)
  @Input() subscribeLive: boolean = true;
  // when true, suppress rendering the embedded graph inside the component
  @Input() noGraph: boolean = false;
  @Output() valueChange: EventEmitter<number> = new EventEmitter<number>();

  private liveSub: Subscription | null = null;
  private warnSub: Subscription | null = null;
  warningActive: boolean = false;

  constructor(private live: LiveDataService, private log: LogService) {
    // subscribe to recent warnings and toggle a local warning flag when this vital is reported
    this.warnSub = this.log.getRecentWarning$().subscribe(entry => {
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

  private subscribeToLive(): void {
    if (this.liveSub) {
      this.liveSub.unsubscribe();
      this.liveSub = null;
    }
    if (!this.vitalName) return;
    try {
      this.liveSub = this.live.getValue$(this.vitalName).subscribe(val => {
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
