import { IsArray, IsIn, IsString } from 'class-validator';

export class BulkUpdateActivitiesTagsDto {
  @IsArray()
  @IsString({ each: true })
  activityIds: string[];

  @IsIn(['add', 'remove'])
  mode: 'add' | 'remove';

  @IsArray()
  @IsString({ each: true })
  tagIds: string[];
}
