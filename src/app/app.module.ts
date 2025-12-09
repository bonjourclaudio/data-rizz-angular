import { NgModule } from '@angular/core';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { FooterComponent } from './layout/footer/footer.component';
import { MainComponent } from './pages/main/main.component';
import { VitalsComponent } from './vitals/vitals/vitals.component';
import { CallbackPipe } from './callback.pipe';
import { GraphComponent } from './vitals/graph/graph.component';
import { EmergencyComponent } from './pages/emergency/emergency.component';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import * as Hammer from 'hammerjs';
import { HammerGestureConfig, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';


export class MyHammerConfig extends HammerGestureConfig {
  override overrides = <any> {
    swipe: { direction: Hammer.DIRECTION_ALL },
  };
}


@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FooterComponent,
    MainComponent,
    VitalsComponent,
    CallbackPipe,
    GraphComponent,
    EmergencyComponent
  ],
  imports: [
    BrowserModule,
    HammerModule,
    CommonModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    RouterModule
  ],
  providers: [
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: MyHammerConfig,
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
