import { Component, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
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
  @Output() valueChange: EventEmitter<number> = new EventEmitter<number>();

  @ViewChild('chart', { static: true }) chartContainer!: ElementRef;

  private animSub: Subscription | null = null;
  private samples: { timestamp: number; value: number }[] = [];
  private data: { t: number; value: number }[] = [];
  private svg: any;
  private x: any;
  private y: any;
  private line: any;
  private width = 300;
  private height = 100;

  private windowSec = 30; // visible window in seconds
  private currentTime = 0;
  private nextIndex = 0;
  private sampleInterval = 1; // seconds between samples (fallback)

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.createChart();
    if (this.vitalName) {
      this.loadSamplesAndStart();
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
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  private resetData(): void {
    this.data = [];
    this.currentTime = 0;
    this.nextIndex = 0;
  }

  private stopAnimation(): void {
    if (this.animSub) {
      this.animSub.unsubscribe();
      this.animSub = null;
    }
  }

  private loadSamplesAndStart(): void {
    if (!this.vitalName) return;
    const path = `assets/data/${this.vitalName}.json`;
    this.http.get<any[]>(path).subscribe({
      next: arr => {
        if (!arr || !Array.isArray(arr) || arr.length === 0) return;
        // accept numeric timestamps (relative) or string (ignore)
        this.samples = arr.map(item => ({ timestamp: Number(item.timestamp), value: +item.value }));
        // derive sampleInterval from first two entries if possible
        if (this.samples.length > 1) {
          this.sampleInterval = Math.abs(this.samples[1].timestamp - this.samples[0].timestamp) || 1;
        }
        this.startAnimation();
      },
      error: () => {
        // silent
      }
    });
  }

  private startAnimation(): void {
    this.stopAnimation();
    // push initial window of data to fill the chart
    const initialCount = Math.min(this.samples.length, Math.ceil(this.windowSec / this.sampleInterval));
    for (let i = 0; i < initialCount; i++) {
      const s = this.samples[i % this.samples.length];
      this.data.push({ t: s.timestamp, value: s.value });
      this.currentTime = s.timestamp;
      this.nextIndex = (i + 1) % this.samples.length;
    }
    // emit current visible value so parent can reflect numeric readout
    if (this.data.length) {
      const last = this.data[this.data.length - 1];
      this.valueChange.emit(last.value);
    }
    // animation tick: advance by sampleInterval
    const tickMs = Math.max(50, Math.round(this.sampleInterval * 1000));
    this.animSub = interval(tickMs).subscribe(() => this.advance());
    this.updateChart();
  }

  private advance(): void {
    if (this.samples.length === 0) return;
    // get next sample
    const s = this.samples[this.nextIndex];
    // increment current time by sampleInterval (creates continuous increasing time)
    this.currentTime += this.sampleInterval;
    this.data.push({ t: this.currentTime, value: s.value });
    this.nextIndex = (this.nextIndex + 1) % this.samples.length;
    // drop old points outside window
    const minTime = this.currentTime - this.windowSec;
    this.data = this.data.filter(p => p.t >= minTime);
    this.updateChart(true);
    // emit the latest numeric value so the parent can update as well
    this.valueChange.emit(s.value);
  }

  private createChart(clear = false): void {
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    // set sizes based on `size`
    this.width = container.clientWidth - 20;
    this.height = 100;

    d3.select(container).selectAll('svg').remove();

    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;

    this.x = d3.scaleLinear().range([0, w]);
    this.y = d3.scaleLinear().range([h, 0]);

    this.line = d3.line<any>().x((d: any) => this.x(d.t)).y((d: any) => this.y(d.value)).curve(d3.curveBasis);

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // background grid group (horizontal lines)
    this.svg.append('g').attr('class', 'grid');

    // path
    this.svg.append('path').attr('class', 'line').attr('fill', 'none').attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  }

  private updateChart(animate = false): void {
    if (!this.svg) return;
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const margin = { top: 6, right: 6, bottom: 6, left: 6 };
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;

    if (this.data.length === 0) {
      this.svg.select('.line').datum([]).attr('d', null);
      return;
    }

    const minT = this.currentTime - this.windowSec;
    this.x.domain([minT, this.currentTime]);

    const yMin = d3.min(this.data, d => d.value) as number;
    const yMax = d3.max(this.data, d => d.value) as number;
    const yPad = (yMax - yMin) * 0.15 || 1;
    this.y.domain([yMin - yPad, yMax + yPad]);

    // draw horizontal grid lines (4 lines)
    const ticks = 4;
    const yTicks = d3.range(ticks + 1).map(i => yMin - yPad + (i / ticks) * ((yMax + yPad) - (yMin - yPad)));
    const grid = this.svg.select('.grid').selectAll('.grid-line').data(yTicks);
    grid.join(
      (enter: any) => enter.append('line').attr('class', 'grid-line').attr('x1', 0).attr('x2', w).attr('y1', (d: number) => this.y(d)).attr('y2', (d: number) => this.y(d)).attr('stroke', '#ffffffff').attr('stroke-opacity', 0.08),
      (update: any) => update.attr('x2', w).attr('y1', (d: number) => this.y(d)).attr('y2', (d: number) => this.y(d)),
      (exit: any) => exit.remove()
    );

    // update path
    const path = this.svg.select('.line').datum(this.data);
    if (animate) {
      path.transition().duration(Math.max(50, Math.round(this.sampleInterval * 1000))).ease(d3.easeLinear).attr('d', this.line as any).attr('stroke', this.color || '#00b2cf');
    } else {
      path.attr('d', this.line as any).attr('stroke', this.color || '#00b2cf');
    }
  }
}
