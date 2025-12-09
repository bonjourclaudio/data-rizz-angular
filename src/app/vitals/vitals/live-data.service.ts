import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { switchMap, map, startWith, shareReplay } from 'rxjs/operators';
import { VitalsService } from './vitals.service';
import { LogService } from 'src/app/log.service';

@Injectable({ providedIn: 'root' })
export class LiveDataService {
  private cache = new Map<string, Observable<number>>();
  private pollMs = 40; // 40ms = 25 samples/sec
  private currentIndices = new Map<string, number>(); // track position in each vital's sample array
  private loadedData = new Map<string, number[]>(); // cache loaded sample arrays

  constructor(private http: HttpClient, private vitals: VitalsService, private log: LogService) {}

  getValue$(vitalName: string): Observable<number> {
    if (!vitalName) throw new Error('vitalName required');
    const key = vitalName;
    if (this.cache.has(key)) return this.cache.get(key)!;

    // Initialize index for this vital if not exists
    if (!this.currentIndices.has(key)) {
      this.currentIndices.set(key, 0);
    }

    const obs = interval(this.pollMs).pipe(
      startWith(0),
      switchMap(async () => {
        // Load data if not cached
        if (!this.loadedData.has(key)) {
          try {
            const data = await this.http.get<any>(`assets/data/${vitalName}.json`).toPromise();
            if (data?.fetch?.signal?.[0]?.samp) {
              this.loadedData.set(key, data.fetch.signal[0].samp);
            } else if (Array.isArray(data)) {
              this.loadedData.set(key, data);
            } else {
              this.loadedData.set(key, []);
            }
          } catch (err) {
            this.loadedData.set(key, []);
          }
        }
        return this.loadedData.get(key) || [];
      }),
      map(samp => {
        if (!samp || samp.length === 0) return 0;
        
        // Get current index and increment it for next poll
        let idx = this.currentIndices.get(key) || 0;
        const v = Number(samp[idx]);
        
        // Move to next sample, loop around if at end
        idx = (idx + 1) % samp.length;
        this.currentIndices.set(key, idx);

        let result = Number(v);
        if (isNaN(result)) result = 0;
        result = Math.round(result);
        result = Math.max(0, result);

        // check against defined vital ranges and create a warning if outside
        try {
          const defs = this.vitals.getAllVitals();
          const def = defs.find(d => d.vitalName === vitalName);
          if (def) {
            const min = Number(def.minVal ?? -Infinity);
            const max = Number(def.maxVal ?? Infinity);
            if (!isNaN(min) && !isNaN(max) && (result < min || result > max)) {
              this.log.addLog({
                vitalName,
                value: result,
                level: 'warning',
                message: `Value ${result} outside range ${min}-${max}`
              });
            }
          }
        } catch (err) {
          // silent: don't let logging break the stream
        }

        return result;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache.set(key, obs);
    return obs;
  }
}
