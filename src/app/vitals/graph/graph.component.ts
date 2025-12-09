import { Component, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnDestroy, OnChanges, AfterViewInit {
  @Input() vitalName: string | undefined = '';
  @Input() color: string | undefined = '#00b2cf';
  @Input() size: string | undefined = 'sm';
  @Input() timeWindowSeconds: number | undefined = 30;
  @Input() timeOffsetSeconds: number | undefined = 0;
  @Input() live: boolean | undefined = true;
  @Output() valueChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() centerValueChange: EventEmitter<number> = new EventEmitter<number>();

  @ViewChild('chart', { static: true }) chartContainer!: ElementRef;

  private samples: { timestamp: number; value: number }[] = [];
  // allSamples can be either an array of numeric samples (ECG style) or derived from timestamp/value pairs
  private allSamples: number[] = [];
  private svg: any;
  private x: any;
  private y: any;
  private line: any;
  private width = 300;
  private height = 100;
  private resizeObserver: ResizeObserver | null = null;

  // playback/control
  private windowSec = 4; // seconds shown by default for high-rate signals
  private samplingRate = 1; // Hz default; will be detected from data
  private samplesPerWindow = 4; // samplingRate * windowSec
  private currentWindowSamples: number[] = [];
  private currentSampleIndex = 0;
  private timerId: any = null;

  constructor(private http: HttpClient, private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    // Use a small delay to ensure layout is finalized
    setTimeout(() => {
      this.createChart();
      if (this.vitalName) {
        this.loadSamplesAndStart();
      }
    }, 50);

    // Set up ResizeObserver to handle container resize
    if (this.chartContainer?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.ngZone.run(() => {
              this.createChart(true);
              this.renderStaticWindow();
            });
          }, 50);
        });
      });
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vitalName'] && !changes['vitalName'].firstChange) {
      this.stopAnimation();
      this.resetData();
      this.createChart(true);
      this.loadSamplesAndStart();
    }
    if (changes['size'] && !changes['size'].firstChange) {
      this.createChart(true);
    }
    if ((changes['timeWindowSeconds'] || changes['timeOffsetSeconds'] || changes['live']) && !changes['vitalName']) {
      // Update samplesPerWindow if timeWindowSeconds changed
      if (changes['timeWindowSeconds']) {
        this.samplesPerWindow = Math.max(1, Math.floor((this.timeWindowSeconds || this.windowSec) * this.samplingRate));
      }
      
      // re-render static window when controls change
      if (this.allSamples && this.allSamples.length > 0) {
        if (this.live) {
          this.startAnimation();
        } else {
          this.renderStaticWindow();
          this.updateChart(this.currentWindowSamples || []);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private resetData(): void {
    this.allSamples = [];
    this.currentSampleIndex = 0;
    this.samplesPerWindow = Math.max(1, Math.floor((this.timeWindowSeconds || this.windowSec) * this.samplingRate));
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
  private stopAnimation(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private loadSamplesAndStart(): void {
    if (!this.vitalName) return;
    const path = `assets/data/${this.vitalName}.json`;
    this.http.get<any>(path).subscribe({
      next: (data: any) => {
        // Two supported formats:
        // 1) ECG-like object: { fetch: { signal: [ { samp: [...] , tps: <Hz> } ] } }
        // 2) simple array: [ { timestamp, value }, ... ]
        this.allSamples = [];
        if (data && typeof data === 'object' && !Array.isArray(data) && (data as any).fetch && Array.isArray((data as any).fetch.signal)) {
          const s = (data as any).fetch.signal[0];
          if (s && Array.isArray(s.samp)) {
            this.allSamples = s.samp.map((v: any) => Number(v));
            this.samplingRate = Number(s.tps) || this.samplingRate;
          }
        } else if (Array.isArray(data)) {
          // array of timestamp/value objects
          const list = data as any[];
          if (list.length === 0) return;
          // derive samplingRate from timestamps if possible
          if (list.length > 1 && list[0].timestamp != null && list[1].timestamp != null) {
            const dt = Math.abs(Number(list[1].timestamp) - Number(list[0].timestamp)) || 1;
            // dt is in seconds in our generator; samplingRate = 1/dt
            this.samplingRate = dt > 0 ? Math.round(1 / dt) || 1 : 1;
          }
          this.allSamples = list.map(it => Number(it.value));
        }

        if (!this.allSamples || this.allSamples.length === 0) return;
        // compute window size in samples
        // For historical view: use a fixed zoom level for detailed exploration
        // This allows navigation through longer periods with buttons/arrows
        this.windowSec = (this.live) ? (Number(this.timeWindowSeconds) || this.windowSec) : 20;
        this.samplesPerWindow = Math.max(1, Math.floor(this.windowSec * this.samplingRate));
        // start at beginning so we play the provided samples in order (do not manipulate)
        this.currentSampleIndex = 0;

        if (this.live) {
          this.startAnimation();
        } else {
          this.renderStaticWindow();
        }
      },
      error: () => {
        // silent
      }
    });
  }

  private renderStaticWindow(): void {
    if (!this.allSamples || this.allSamples.length === 0) return;
    
    // Calculate center position based on timeOffsetSeconds
    // When offset = 0, center should be at the end (most recent)
    // When offset increases, center moves back in time
    const totalDuration = this.allSamples.length / this.samplingRate; // total seconds of data
    const centerTime = totalDuration - (this.timeOffsetSeconds || 0);
    const centerIndex = Math.floor(centerTime * this.samplingRate);
    
    // Calculate window around center
    const halfWindow = Math.floor(this.samplesPerWindow / 2);
    const start = Math.max(0, centerIndex - halfWindow);
    const end = Math.min(this.allSamples.length, start + this.samplesPerWindow);
    
    const windowSamples = this.allSamples.slice(start, end);
    
    // Pad if needed (at edges)
    if (windowSamples.length < this.samplesPerWindow) {
      const padding = new Array(this.samplesPerWindow - windowSamples.length).fill(windowSamples[0] || 0);
      if (start === 0) {
        windowSamples.unshift(...padding);
      } else {
        windowSamples.push(...padding);
      }
    }
    
    // Store for re-rendering and compute scales/render
    this.currentWindowSamples = windowSamples;
    this.updateChart(windowSamples);
    
    // emit center value
    if (windowSamples.length > 0) {
      const centerVal = windowSamples[Math.floor(windowSamples.length / 2)];
      this.valueChange.emit(centerVal);
      this.centerValueChange.emit(centerVal);
    }
  }


  private startAnimation(): void {
    this.stopAnimation();
    // compute update timing
    const updateIntervalMs = Math.max(2, Math.round(1000 / this.samplingRate));
    // ensure samplesPerWindow is up to date
    this.windowSec = Number(this.timeWindowSeconds) || this.windowSec;
    this.samplesPerWindow = Math.max(1, Math.floor(this.windowSec * this.samplingRate));
    // start from currentSampleIndex (already set in loadSamplesAndStart)
    // use setInterval for predictable timing
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.timerId = setInterval(() => this.tick(), updateIntervalMs);
    // initial render
    const start = Math.max(0, this.currentSampleIndex - this.samplesPerWindow + 1);
    const windowSamples = this.getWindowSamples(this.currentSampleIndex);
    this.updateChart(windowSamples);
  }

  private tick(): void {
    // render current window (forward slice) then advance the playhead
    const windowSamples = this.getWindowSamples(this.currentSampleIndex);
    this.updateChart(windowSamples);
    // emit current sample value
    if (this.allSamples.length) this.valueChange.emit(this.allSamples[this.currentSampleIndex]);
    // advance for next tick
    this.currentSampleIndex = (this.currentSampleIndex + 1) % this.allSamples.length;
  }

  private getWindowSamples(currentIndex: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.samplesPerWindow; i++) {
      const idx = (currentIndex + i) % this.allSamples.length;
      out.push(this.allSamples[idx]);
    }
    return out;
  }

  private createChart(clear = false): void {
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    // set sizes based on `size`
    this.width = container.clientWidth;
    this.height = 100;

    d3.select(container).selectAll('svg').remove();

    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;

    this.x = d3.scaleLinear().range([0, w]);
    this.y = d3.scaleLinear().range([h, 0]);

    // use linear curve to avoid smoothing/morphing artifacts for real-time vitals/ECG
    this.line = d3.line<any>().x((d: any, i: number) => this.x(i / this.samplingRate)).y((d: any) => this.y(d)).curve(d3.curveLinear);

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'none')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // background grid group (horizontal lines)
    this.svg.append('g').attr('class', 'grid');

    // path
    this.svg.append('path').attr('class', 'line').attr('fill', 'none').attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  }

  private updateChart(windowSamples: number[]): void {
    if (!this.svg) return;
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;

    if (!windowSamples || windowSamples.length === 0) {
      this.svg.select('.line').datum([]).attr('d', null);
      return;
    }

    // x domain 0..timeWindowSeconds (or windowSec as fallback)
    const displayWindowSec = this.timeWindowSeconds || this.windowSec;
    this.x.domain([0, displayWindowSec]);

    const yMin = d3.min(windowSamples, d => d) as number;
    const yMax = d3.max(windowSamples, d => d) as number;
    const yPad = (yMax - yMin) * 0.12 || Math.max(1, Math.abs(yMax) * 0.1);
    this.y.domain([yMin - yPad, yMax + yPad]);

    // draw horizontal grid lines (4 lines)
    const ticks = 4;
    const yTicks = d3.range(ticks + 1).map(i => yMin - yPad + (i / ticks) * ((yMax + yPad) - (yMin - yPad)));
    const grid = this.svg.select('.grid').selectAll('.grid-line').data(yTicks);
    grid.join(
      (enter: any) => enter.append('line').attr('class', 'grid-line').attr('x1', 0).attr('x2', w).attr('y1', (d: number) => this.y(d)).attr('y2', (d: number) => this.y(d)).attr('stroke', '#ffffff').attr('stroke-opacity', 0.06),
      (update: any) => update.attr('x2', w).attr('y1', (d: number) => this.y(d)).attr('y2', (d: number) => this.y(d)),
      (exit: any) => exit.remove()
    );

    // update path
    const path = this.svg.select('.line').datum(windowSamples as any);
    path.attr('d', this.line as any).attr('stroke', this.color || '#00b2cf');
  }
}
