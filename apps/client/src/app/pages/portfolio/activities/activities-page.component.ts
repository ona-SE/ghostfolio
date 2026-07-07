import { IcsService } from '@ghostfolio/client/services/ics/ics.service';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { DEFAULT_PAGE_SIZE } from '@ghostfolio/common/config';
import { CreateOrderDto, UpdateOrderDto } from '@ghostfolio/common/dtos';
import { downloadAsFile } from '@ghostfolio/common/helper';
import {
  Activity,
  AssetProfileIdentifier,
  Filter,
  User
} from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { DateRange } from '@ghostfolio/common/types';
import { GfActivitiesTableComponent } from '@ghostfolio/ui/activities-table';
import { DataService } from '@ghostfolio/ui/services';

import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Sort, SortDirection } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { Tag } from '@prisma/client';
import { format, parseISO } from 'date-fns';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Subscription } from 'rxjs';

import { filterActivitiesBySearchQuery } from './activities-search.helper';
import { GfCreateOrUpdateActivityDialogComponent } from './create-or-update-activity-dialog/create-or-update-activity-dialog.component';
import { CreateOrUpdateActivityDialogParams } from './create-or-update-activity-dialog/interfaces/interfaces';
import { GfImportActivitiesDialogComponent } from './import-activities-dialog/import-activities-dialog.component';
import { ImportActivitiesDialogParams } from './import-activities-dialog/interfaces/interfaces';

@Component({
  host: { class: 'has-fab' },
  imports: [
    GfActivitiesTableComponent,
    IonIcon,
    MatButtonModule,
    MatSnackBarModule,
    RouterModule
  ],
  selector: 'gf-activities-page',
  styleUrls: ['./activities-page.scss'],
  templateUrl: './activities-page.html'
})
export class GfActivitiesPageComponent implements OnInit {
  public static readonly SERVER_SIDE_SEARCH_THRESHOLD = 1000;

  public activityTypesFilter: string[] = [];
  public dataSource: MatTableDataSource<Activity> | undefined;
  public deviceType: string;
  public hasImpersonationId: boolean;
  public hasPermissionToCreateActivity: boolean;
  public hasPermissionToDeleteActivity: boolean;
  public hasPermissionToUpdateActivity: boolean;
  public pageIndex = 0;
  public pageSize = DEFAULT_PAGE_SIZE;
  public routeQueryParams: Subscription;
  public searchQuery = '';
  public sortColumn = 'date';
  public sortDirection: SortDirection = 'desc';
  public tags: Tag[] = [];
  public totalItems: number | undefined;
  public user: User | undefined;

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private deviceService: DeviceDetectorService,
    private dialog: MatDialog,
    private icsService: IcsService,
    private impersonationStorageService: ImpersonationStorageService,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) {
    this.routeQueryParams = route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['createDialog']) {
          if (params['activityId']) {
            this.dataService
              .fetchActivity(params['activityId'])
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((activity) => {
                this.openCreateActivityDialog(activity);
              });
          } else {
            this.openCreateActivityDialog();
          }
        } else if (params['editDialog']) {
          if (params['activityId']) {
            this.dataService
              .fetchActivity(params['activityId'])
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe((activity) => {
                this.openUpdateActivityDialog(activity);
              });
          } else {
            this.router.navigate(['.'], { relativeTo: this.route });
          }
        }
      });

    addIcons({ addOutline });
  }

  public ngOnInit() {
    this.deviceType = this.deviceService.getDeviceInfo().deviceType;

    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.hasImpersonationId = !!impersonationId;
      });

    this.dataService
      .fetchTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tags) => {
        this.tags = tags;
        this.changeDetectorRef.markForCheck();
      });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.updateUser(state.user);

          this.fetchActivities();

          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public fetchActivities() {
    // Reset dataSource and totalItems to show loading state
    this.dataSource = undefined;
    this.totalItems = undefined;

    const dateRange = this.user?.settings?.dateRange;
    const range = this.isCalendarYear(dateRange) ? dateRange : undefined;

    const filters: Filter[] = this.userService.getFilters();

    const useServerSideSearch =
      !!this.searchQuery && this.isServerSideSearchEnabled();

    if (useServerSideSearch) {
      filters.push({
        id: this.searchQuery,
        type: 'SEARCH_QUERY'
      });
    }

    this.dataService
      .fetchActivities({
        filters,
        range,
        activityTypes: this.activityTypesFilter.length
          ? this.activityTypesFilter
          : undefined,
        skip: useServerSideSearch
          ? this.pageIndex * this.pageSize
          : this.searchQuery
            ? 0
            : this.pageIndex * this.pageSize,
        sortColumn: this.sortColumn,
        sortDirection: this.sortDirection,
        take:
          !useServerSideSearch && this.searchQuery
            ? GfActivitiesPageComponent.SERVER_SIDE_SEARCH_THRESHOLD
            : this.pageSize
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ activities, count }) => {
        const filteredActivities =
          !useServerSideSearch && this.searchQuery
            ? filterActivitiesBySearchQuery({
                activities,
                searchQuery: this.searchQuery
              })
            : activities;

        this.dataSource = new MatTableDataSource(
          !useServerSideSearch && this.searchQuery
            ? filteredActivities.slice(
                this.pageIndex * this.pageSize,
                (this.pageIndex + 1) * this.pageSize
              )
            : filteredActivities
        );
        this.totalItems =
          !useServerSideSearch && this.searchQuery
            ? filteredActivities.length
            : count;

        if (
          this.hasPermissionToCreateActivity &&
          this.user?.activitiesCount === 0
        ) {
          this.router.navigate([], { queryParams: { createDialog: true } });
        }

        this.changeDetectorRef.markForCheck();
      });
  }

  private isServerSideSearchEnabled() {
    return (
      (this.user?.activitiesCount ?? 0) >=
      GfActivitiesPageComponent.SERVER_SIDE_SEARCH_THRESHOLD
    );
  }

  public onChangePage(page: PageEvent) {
    this.pageIndex = page.pageIndex;

    this.fetchActivities();
  }

  public onClickActivity({ dataSource, symbol }: AssetProfileIdentifier) {
    this.router.navigate([], {
      queryParams: {
        dataSource,
        symbol,
        holdingDetailDialog: true
      }
    });
  }

  public onCloneActivity(aActivity: Activity) {
    this.openCreateActivityDialog(aActivity);
  }

  public onBulkTagAdd({
    activityIds,
    tagIds
  }: {
    activityIds: string[];
    tagIds: string[];
  }) {
    this.dataService
      .bulkUpdateActivitiesTags({ activityIds, mode: 'add', tagIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetchActivities();
        this.changeDetectorRef.markForCheck();
      });
  }

  public onBulkTagRemove({
    activityIds,
    tagIds
  }: {
    activityIds: string[];
    tagIds: string[];
  }) {
    this.dataService
      .bulkUpdateActivitiesTags({ activityIds, mode: 'remove', tagIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.fetchActivities();
        this.changeDetectorRef.markForCheck();
      });
  }

  public onDeleteActivities() {
    this.dataService
      .deleteActivities({
        filters: this.userService.getFilters()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();

        this.fetchActivities();

        this.changeDetectorRef.markForCheck();
      });
  }

  public onDeleteActivity(aId: string) {
    this.dataService
      .deleteActivity(aId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();

        this.fetchActivities();

        this.changeDetectorRef.markForCheck();
      });
  }

  public onExport(activityIds?: string[]) {
    let fetchExportParams: any = { activityIds };

    if (!activityIds) {
      fetchExportParams = {
        activityTypes: this.activityTypesFilter.length
          ? this.activityTypesFilter
          : undefined,
        filters: this.userService.getFilters()
      };
    }

    this.dataService
      .fetchExport(fetchExportParams)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        for (const activity of data.activities) {
          delete (activity as unknown as Partial<Activity>).id;
        }

        downloadAsFile({
          content: data,
          fileName: `ghostfolio-export-${format(
            parseISO(data.meta.date),
            'yyyyMMddHHmm'
          )}.json`,
          format: 'json'
        });
      });
  }

  public onExportCsv() {
    const fetchExportParams = {
      activityTypes: this.activityTypesFilter.length
        ? this.activityTypesFilter
        : undefined,
      filters: this.userService.getFilters()
    };

    this.dataService
      .fetchExport(fetchExportParams)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const headers = [
          'Date',
          'Symbol',
          'Type',
          'Quantity',
          'Unit Price',
          'Fee',
          'Currency',
          'Account'
        ];

        const accountMap = new Map(
          data.accounts.map((account) => [account.id, account.name])
        );

        const rows = data.activities.map((activity) => [
          activity.date,
          activity.symbol,
          activity.type,
          String(activity.quantity),
          String(activity.unitPrice),
          String(activity.fee),
          activity.currency ?? '',
          activity.accountId ? (accountMap.get(activity.accountId) ?? '') : ''
        ]);

        downloadAsFile({
          content: { headers, rows },
          fileName: `ghostfolio-export-${format(
            parseISO(data.meta.date),
            'yyyyMMddHHmm'
          )}.csv`,
          format: 'csv'
        });
      });
  }

  public onExportTaxCsv() {
    this.dataService
      .fetchTaxCsvExport({
        filters: this.userService.getFilters()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const headers = [
          'Disposal Date',
          'Acquisition Date',
          'Symbol',
          'Type',
          'Quantity',
          'Cost Basis',
          'Proceeds',
          'Gain/Loss',
          'Currency',
          'Account'
        ];

        const rows = data.items.map((item) => [
          item.disposalDate
            ? format(parseISO(item.disposalDate), 'yyyy-MM-dd')
            : '',
          item.acquisitionDate
            ? format(parseISO(item.acquisitionDate), 'yyyy-MM-dd')
            : '',
          item.symbol,
          item.type,
          String(item.quantity),
          String(item.costBasis),
          String(item.proceeds),
          String(item.gainLoss),
          item.currency,
          item.account
        ]);

        downloadAsFile({
          content: { headers, rows },
          fileName: `ghostfolio-tax-report-${format(
            parseISO(data.meta.date),
            'yyyyMMddHHmm'
          )}.csv`,
          format: 'csv'
        });
      });
  }

  public onExportDrafts(activityIds?: string[]) {
    this.dataService
      .fetchExport({ activityIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        downloadAsFile({
          content: this.icsService.transformActivitiesToIcsContent(
            data.activities
          ),
          contentType: 'text/calendar',
          fileName: `ghostfolio-draft${
            data.activities.length > 1 ? 's' : ''
          }-${format(parseISO(data.meta.date), 'yyyyMMddHHmmss')}.ics`,
          format: 'string'
        });
      });
  }

  public onImport() {
    if (!this.user) {
      return;
    }

    const dialogRef = this.dialog.open<
      GfImportActivitiesDialogComponent,
      ImportActivitiesDialogParams
    >(GfImportActivitiesDialogComponent, {
      data: {
        deviceType: this.deviceType,
        user: this.user
      },
      height: this.deviceType === 'mobile' ? '98vh' : undefined,
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();

        this.fetchActivities();

        this.changeDetectorRef.markForCheck();
      });
  }

  public onImportDividends() {
    if (!this.user) {
      return;
    }

    const dialogRef = this.dialog.open<
      GfImportActivitiesDialogComponent,
      ImportActivitiesDialogParams
    >(GfImportActivitiesDialogComponent, {
      data: {
        activityTypes: ['DIVIDEND'],
        deviceType: this.deviceType,
        user: this.user
      },
      height: this.deviceType === 'mobile' ? '98vh' : undefined,
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.userService
          .get(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe();

        this.fetchActivities();

        this.changeDetectorRef.markForCheck();
      });
  }

  public onSearchChanged(query: string) {
    this.searchQuery = query;
    this.pageIndex = 0;

    this.fetchActivities();
  }

  public onSortChanged({ active, direction }: Sort) {
    this.pageIndex = 0;
    this.sortColumn = active;
    this.sortDirection = direction;

    this.fetchActivities();
  }

  public onTypesFilterChanged(aTypes: string[]) {
    this.activityTypesFilter = aTypes;
    this.pageIndex = 0;

    this.fetchActivities();
  }

  public onUpdateActivity(aActivity: Activity) {
    this.router.navigate([], {
      queryParams: { activityId: aActivity.id, editDialog: true }
    });
  }

  public openUpdateActivityDialog(aActivity: Activity) {
    if (!this.user) {
      return;
    }

    const dialogRef = this.dialog.open<
      GfCreateOrUpdateActivityDialogComponent,
      CreateOrUpdateActivityDialogParams
    >(GfCreateOrUpdateActivityDialogComponent, {
      data: {
        activity: aActivity,
        accounts: this.user.accounts,
        user: this.user
      },
      height: this.deviceType === 'mobile' ? '98vh' : '80vh',
      width: this.deviceType === 'mobile' ? '100vw' : '50rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((activity: UpdateOrderDto) => {
        if (activity) {
          this.dataService
            .putActivity(activity)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.fetchActivities();

                this.changeDetectorRef.markForCheck();
              }
            });
        }

        this.router.navigate(['.'], { relativeTo: this.route });
      });
  }

  private isCalendarYear(dateRange: DateRange | undefined) {
    if (!dateRange) {
      return false;
    }

    return /^\d{4}$/.test(dateRange);
  }

  private openCreateActivityDialog(aActivity?: Activity) {
    this.userService
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.updateUser(user);
        const currentUser = user;

        const dialogRef = this.dialog.open<
          GfCreateOrUpdateActivityDialogComponent,
          CreateOrUpdateActivityDialogParams
        >(GfCreateOrUpdateActivityDialogComponent, {
          data: {
            accounts: currentUser.accounts,
            activity: {
              ...aActivity,
              accountId: aActivity?.accountId,
              date: new Date(),
              id: null,
              fee: 0,
              type: aActivity?.type ?? 'BUY',
              unitPrice: null
            } as unknown as CreateOrUpdateActivityDialogParams['activity'],
            user: currentUser
          },
          height: this.deviceType === 'mobile' ? '98vh' : '80vh',
          width: this.deviceType === 'mobile' ? '100vw' : '50rem'
        });

        dialogRef
          .afterClosed()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((transaction: CreateOrderDto | null) => {
            if (transaction) {
              this.dataService.postActivity(transaction).subscribe({
                next: () => {
                  this.userService
                    .get(true)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe();

                  this.fetchActivities();

                  this.changeDetectorRef.markForCheck();
                }
              });
            }

            this.router.navigate(['.'], { relativeTo: this.route });
          });
      });
  }

  private updateUser(aUser: User) {
    this.user = aUser;

    this.hasPermissionToCreateActivity =
      !this.hasImpersonationId &&
      hasPermission(this.user.permissions, permissions.createActivity);
    this.hasPermissionToDeleteActivity =
      !this.hasImpersonationId &&
      hasPermission(this.user.permissions, permissions.deleteActivity);
    this.hasPermissionToUpdateActivity =
      !this.hasImpersonationId &&
      hasPermission(this.user.permissions, permissions.updateActivity);
  }
}
