import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { GfComparisonPageComponent } from './comparison-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfComparisonPageComponent,
    path: '',
    title: internalRoutes.portfolio.subRoutes.comparison.title
  }
];
