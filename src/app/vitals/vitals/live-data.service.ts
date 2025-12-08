import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { switchMap, map, startWith, shareReplay } from 'rxjs/operators';
import { VitalsService } from './vitals.service';
import { LogService } from 'src/app/log.service';

@Injectable({ providedIn: 'root' })
export class LiveDataService {
  private cache = new Map<string, Observable<number>>();
  private pollMs = 1000;

  constructor(private http: HttpClient, private vitals: VitalsService, private log: LogService) {}

  getValue$(vitalName: string): Observable<number> {
    if (!vitalName) throw new Error('vitalName required');
    const key = vitalName;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const obs = interval(this.pollMs).pipe(
      startWith(0),
      switchMap(() => this.http.get<any[]>(`assets/data/${vitalName}.json`)),
      map(arr => {
        if (!arr || !Array.isArray(arr) || arr.length === 0) return 0;
        const last = arr[arr.length - 1];
        let v = Number(last?.value);
        if (isNaN(v)) v = 0;
        v = Math.round(v);
        // ensure non-negative
        v = Math.max(0, v);

        // check against defined vital ranges and create a warning if outside
        try {
          const defs = this.vitals.getAllVitals();
          const def = defs.find(d => d.vitalName === vitalName);
          if (def) {
            const min = Number(def.minVal ?? -Infinity);
            const max = Number(def.maxVal ?? Infinity);
            if (!isNaN(min) && !isNaN(max) && (v < min || v > max)) {
              this.log.addLog({
                vitalName,
                value: v,
                level: 'warning',
                message: `Value ${v} outside range ${min}-${max}`
              });
            }
          }
        } catch (err) {
          // silent: don't let logging break the stream
        }

        return v;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.cache.set(key, obs);
    return obs;
  }
}
