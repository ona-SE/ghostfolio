import { UserService } from '@ghostfolio/client/services/user/user.service';
import { RecurringInvestmentPlan, User } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { DataService } from '@ghostfolio/ui/services';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  pauseOutline,
  playOutline,
  trashOutline
} from 'ionicons/icons';
import { Subject } from 'rxjs';

@Component({
  host: { class: 'has-fab' },
  imports: [CommonModule, IonIcon, MatButtonModule, MatTableModule],
  selector: 'gf-dca-page',
  styleUrls: ['./dca-page.scss'],
  templateUrl: './dca-page.html'
})
export class GfDcaPageComponent implements OnInit {
  public displayedColumns: string[] = [
    'symbolName',
    'amount',
    'frequency',
    'startDate',
    'isActive',
    'actions'
  ];
  public hasPermissionToCreate: boolean;
  public plans: RecurringInvestmentPlan[] = [];
  public user: User;

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private dialog: MatDialog,
    private userService: UserService
  ) {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.hasPermissionToCreate = hasPermission(
            this.user.permissions,
            permissions.createRecurringInvestmentPlan
          );
          this.changeDetectorRef.markForCheck();
        }
      });

    addIcons({
      addOutline,
      createOutline,
      pauseOutline,
      playOutline,
      trashOutline
    });
  }

  public ngOnInit() {
    this.fetchPlans();
  }

  public onDeletePlan(aId: string) {
    this.dataService
      .deleteRecurringInvestmentPlan(aId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.fetchPlans();
        }
      });
  }

  public onTogglePlan(plan: RecurringInvestmentPlan) {
    this.dataService
      .putRecurringInvestmentPlan({
        id: plan.id,
        isActive: !plan.isActive
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.fetchPlans();
        }
      });
  }

  private fetchPlans() {
    this.dataService
      .fetchRecurringInvestmentPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ plans }) => {
          this.plans = plans;
          this.changeDetectorRef.markForCheck();
        }
      });
  }
}
