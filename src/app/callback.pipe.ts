import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'callback'
})
export class CallbackPipe implements PipeTransform {

 // Example pipe that filters out active vitals
 // Usage: *ngFor="let vital of vitals | callback:filterActiveVitals"
  transform(vitals: any[], callback: (vital: any) => boolean): any[] {
    return vitals.filter(callback);
  }

}
