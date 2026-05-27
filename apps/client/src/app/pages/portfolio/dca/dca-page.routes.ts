import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfDcaPageComponent } from './dca-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfDcaPageComponent,
    path: '',
    title: internalRoutes.portfolio.subRoutes.dca.title
  }
];
