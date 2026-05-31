import { UserService } from '@ghostfolio/client/services/user/user.service';
import {
  RebalancingSuggestion,
  User
} from '@ghostfolio/common/interfaces';
import { DataService } from '@ghostfolio/ui/services';
import { GfValueComponent } from '@ghostfolio/ui/value';

import { DecimalPipe, NgClass, PercentPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';

@Component({
  imports: [
    DecimalPipe,
    GfValueComponent,
    MatCardModule,
    MatProgressBarModule,
    MatTableModule,
    NgClass,
    PercentPipe
  ],
  selector: 'gf-rebalancing-page',
  styleUrl: './rebalancing-page.scss',
  templateUrl: './rebalancing-page.html'
})
export class GfRebalancingPageComponent implements OnInit {
  public displayedColumns = [
    'assetClass',
    'currentPercentage',
    'targetPercentage',
    'deltaPercentage',
    'deltaValue'
  ];
  public isLoading = false;
  public suggestions: RebalancingSuggestion[] = [];
  public totalInvestedValueInBaseCurrency = 0;
  public user: User;

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private userService: UserService
  ) {}

  public ngOnInit() {
    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.fetchRebalancing();
          this.changeDetectorRef.markForCheck();
        }
      });

    this.fetchRebalancing();
  }

  private fetchRebalancing() {
    this.isLoading = true;

    this.dataService
      .fetchPortfolioRebalancing()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        ({ suggestions, totalInvestedValueInBaseCurrency }) => {
          this.suggestions = suggestions;
          this.totalInvestedValueInBaseCurrency =
            totalInvestedValueInBaseCurrency;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      );
  }
}
