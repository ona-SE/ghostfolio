import { Activity, ActivityError } from '@ghostfolio/common/interfaces';

export interface ImportResponse {
  activities: Activity[];
  errors?: ImportActivityError[];
  isDryRun?: boolean;
}

export interface ImportActivityError {
  index: number;
  errors: ActivityError[];
}
