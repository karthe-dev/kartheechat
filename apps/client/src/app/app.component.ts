import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast.component';
import { routeAnimation } from './animations/route.animations';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastComponent],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    animations: [routeAnimation],
})
export class AppComponent {
  prepareRoute(outlet: RouterOutlet) {
    return outlet?.isActivated ? outlet.activatedRouteData?.['animation'] || outlet.activatedRoute?.routeConfig?.path || '' : '';
  }
}
