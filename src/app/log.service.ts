import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface LogEntry {
  id: string;
  ts: number;
  vitalName: string;
  value: number;
  level: 'info' | 'warning' | 'error';
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private logs: LogEntry[] = [];
  private logs$ = new BehaviorSubject<LogEntry[]>([]);
  private count$ = new BehaviorSubject<number>(0);
  // stream of recent warnings (emits the LogEntry when added)
  private recentWarning$ = new Subject<LogEntry>();
  // keep last warning timestamp per vital to avoid spamming
  private lastWarningTs = new Map<string, number>();
  // minimum interval between warnings for the same vital (ms)
  private warningDebounceMs = 30 * 1000;

  constructor() {}

  addLog(entry: Omit<LogEntry, 'id' | 'ts'>) {
    // if this is a warning, check debounce map and ignore if too-frequent
    if (entry.level === 'warning') {
      const last = this.lastWarningTs.get(entry.vitalName) ?? 0;
      const now = Date.now();
      if (now - last < this.warningDebounceMs) {
        // ignore this warning as it's within the debounce window
        return undefined;
      }
      this.lastWarningTs.set(entry.vitalName, now);
    }

    const full: LogEntry = {
      ...entry,
      id: `${entry.vitalName}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      ts: Date.now()
    };
    this.logs.push(full);
    this.logs$.next([...this.logs]);
    this.count$.next(this.logs.length);
    if (full.level === 'warning') {
      this.recentWarning$.next(full);
    }
    return full;
  }

  getLogs$(): Observable<LogEntry[]> {
    return this.logs$.asObservable();
  }

  getLogCount$(): Observable<number> {
    return this.count$.asObservable();
  }

  getRecentWarning$(): Observable<LogEntry> {
    return this.recentWarning$.asObservable();
  }
}
