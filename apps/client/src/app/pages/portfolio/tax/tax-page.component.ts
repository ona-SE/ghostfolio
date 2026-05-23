import { UserService } from '@ghostfolio/client/services/user/user.service';
import { downloadAsFile } from '@ghostfolio/common/helper';
import {
  TaxReportItem,
  TaxReportResponse,
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { format, parseISO } from 'date-fns';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  imports: [
    CommonModule,
    FormsModule,
    GfValueComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    NgxSkeletonLoaderModule
  ],
  selector: 'gf-tax-page',
  styleUrls: ['./tax-page.scss'],
  templateUrl: './tax-page.html'
})
export class GfTaxPageComponent implements OnInit {
  public baseCurrency: string;
  public displayedColumns = [
    'disposalDate',
    'acquisitionDate',
    'symbol',
    'type',
    'quantity',
    'costBasis',
    'proceeds',
    'gainLoss',
    'holdingPeriod',
    'account'
  ];
  public isLoading = false;
  public items: TaxReportItem[] = [];
  public selectedYear: number;
  public summary: TaxReportResponse['summary'];
  public user: User;
  public yearOptions: number[] = [];

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private userService: UserService
  ) {}

  public ngOnInit() {
    const currentYear = new Date().getFullYear();

    this.yearOptions = [];

    for (let year = currentYear; year >= currentYear - 5; year--) {
      this.yearOptions.push(year);
    }

    this.selectedYear = currentYear;

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.changeDetectorRef.markForCheck();
        }
      });

    this.loadReport();
  }

  public onYearChange() {
    this.loadReport();
  }

  public onExportCsv() {
    if (!this.items?.length) {
      return;
    }

    const headers = [
      'Disposal Date',
      'Acquisition Date',
      'Symbol',
      'Type',
      'Quantity',
      'Cost Basis',
      'Proceeds',
      'Gain/Loss',
      'Holding Period (Days)',
      'Long Term',
      'Currency',
      'Account'
    ];

    const rows = this.items.map((item) => [
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
      String(item.holdingPeriodInDays),
      item.isLongTerm ? 'Yes' : 'No',
      item.currency,
      item.account
    ]);

    downloadAsFile({
      content: { headers, rows },
      fileName: `ghostfolio-tax-report-${this.selectedYear}.csv`,
      format: 'csv'
    });
  }

  private loadReport() {
    this.isLoading = true;

    this.dataService
      .fetchTaxReport({ taxYear: this.selectedYear })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.baseCurrency = data.meta.baseCurrency;
        this.items = data.items;
        this.summary = data.summary;
        this.isLoading = false;

        this.changeDetectorRef.markForCheck();
      });
  }
}
