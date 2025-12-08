import { Component } from '@angular/core';
import { PresetsService } from 'src/app/presets.service';
import { LogService } from 'src/app/log.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {

  currentTime: number = Date.now();

  constructor(public presets: PresetsService, private log: LogService) {
    setInterval(() => {
      this.currentTime = Date.now();
    }, 1000);
  }

  get logCount$() {
    return this.log.getLogCount$();
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
