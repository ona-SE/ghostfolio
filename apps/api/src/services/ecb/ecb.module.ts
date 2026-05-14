import { EcbService } from '@ghostfolio/api/services/ecb/ecb.service';

import { Module } from '@nestjs/common';

@Module({
  exports: [EcbService],
  providers: [EcbService]
})
export class EcbModule {}
