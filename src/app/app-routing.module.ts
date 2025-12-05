import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainComponent } from './pages/main/main.component';
import { EmergencyComponent } from './pages/emergency/emergency.component';

const routes: Routes = [
  {
    "path": "main",
    "component": MainComponent
  },
  {
    "path": "emergency",
    "component": EmergencyComponent
  },
  {
    "path": "",
    "redirectTo": "main",
    "pathMatch": "full"
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
