import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

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
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    RouterModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
