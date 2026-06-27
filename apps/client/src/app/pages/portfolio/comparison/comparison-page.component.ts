import { UserService } from '@ghostfolio/client/services/user/user.service';
import {
  PortfolioComparisonResponse,
  User
} from '@ghostfolio/common/interfaces';
import { DataService } from '@ghostfolio/ui/services';
import { GfValueComponent } from '@ghostfolio/ui/value';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Account } from '@prisma/client';
import { DeviceDetectorService } from 'ngx-device-detector';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  imports: [
    CommonModule,
    FormsModule,
    GfValueComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatOptionModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NgxSkeletonLoaderModule
  ],
  selector: 'gf-comparison-page',
  styleUrls: ['./comparison-page.scss'],
  templateUrl: './comparison-page.html'
})
export class GfComparisonPageComponent implements OnInit {
  public accounts: Account[] = [];
  public comparisonData: PortfolioComparisonResponse | undefined;
  public deviceType: string;
  public holdingOverlapSymbols: string[] = [];
  public isLoading = false;
  public selectedAccountIds: string[] = [];
  public user: User;

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private deviceService: DeviceDetectorService,
    private userService: UserService
  ) {}

  public ngOnInit() {
    this.deviceType = this.deviceService.getDeviceInfo().deviceType;

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.changeDetectorRef.markForCheck();
        }
      });

    this.dataService
      .fetchAccounts()
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(({ accounts }) => {
        this.accounts = accounts;
        this.changeDetectorRef.markForCheck();
      });
  }

  public onCompare() {
    if (this.selectedAccountIds.length < 2) {
      return;
    }

    this.isLoading = true;
    this.comparisonData = undefined;

    this.dataService
      .fetchPortfolioComparison({
        accountIds: this.selectedAccountIds,
        range: 'max'
      })
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((response) => {
        this.comparisonData = response;
        this.holdingOverlapSymbols = Object.keys(response.holdingOverlap ?? {});
        this.isLoading = false;
        this.changeDetectorRef.markForCheck();
      });
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }
}
