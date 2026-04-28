-- CreateIndex
CREATE INDEX "MarketData_symbol_dataSource_date_idx" ON "MarketData"("symbol", "dataSource", "date");
