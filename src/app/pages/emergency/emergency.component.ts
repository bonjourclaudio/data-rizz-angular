import { Component, OnInit } from '@angular/core';
import { Vital } from 'src/app/vitals/vitals/vital.model';
import { VitalsService } from 'src/app/vitals/vitals/vitals.service';

@Component({
  selector: 'app-emergency',
  templateUrl: './emergency.component.html',
  styleUrls: ['./emergency.component.scss']
})
export class EmergencyComponent implements OnInit {

  vitalsToShow: Vital[] = [];

  constructor(private vitalSerivce: VitalsService) {   
  }

  ngOnInit(): void {
      if (this.vitalsToShow.length === 0) {
        this.vitalsToShow.push(...this.vitalSerivce.getVitals().filter(v => v.vitalName === 'ABP' || v.vitalName === 'HR' || v.vitalName === 'RR' || v.vitalName === 'SpO2'));
      }
    
  }

}
