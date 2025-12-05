import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { FooterComponent } from './layout/footer/footer.component';
import { MainComponent } from './pages/main/main.component';
import { EmergencyComponent } from './pages/emergency/emergency.component';
import { VitalsComponent } from './vitals/vitals/vitals.component';
import { CallbackPipe } from './callback.pipe';
import { GraphComponent } from './vitals/graph/graph.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FooterComponent,
    MainComponent,
    EmergencyComponent,
    VitalsComponent,
    CallbackPipe,
    GraphComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
