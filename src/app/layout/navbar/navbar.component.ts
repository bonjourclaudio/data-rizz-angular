import { Component, Input, OnInit } from '@angular/core';
import { PresetsService } from 'src/app/presets.service';
import { LogService } from 'src/app/log.service';
import { Router, NavigationEnd } from '@angular/router';


import {filter} from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {
  currentTime: number = Date.now();

  emergency: boolean = false;

  constructor(public presets: PresetsService, private log: LogService, public router: Router) {
    setInterval(() => {
      this.currentTime = Date.now();
    }, 1000);
  }

   ngOnInit() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    )
    .subscribe((event: NavigationEnd) => {
      if (event.url === '/emergency') {
        this.emergency = true;
      } else {
        this.emergency = false;
      }
    });
  }

  get logCount$() {
    return this.log.getLogCount$();
  }

  warnlogToggle = false;

  toggleWarnlog() {
    this.warnlogToggle = !this.warnlogToggle;
  }

  nextPreset() {
    this.presets.next();
  }

  prevPreset() {
    this.presets.prev();
  }

  // UI click: request saving current slots as a new preset (no prompt)
  requestSavePreset() {
    this.presets.requestSave();
  }

  // expose display name observable for template
  get displayName$() {
    return this.presets.getDisplayName$();
  }
}
