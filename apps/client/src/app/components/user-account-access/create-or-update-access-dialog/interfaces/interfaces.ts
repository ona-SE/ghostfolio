import { Access } from '@ghostfolio/common/interfaces';

export interface CreateOrUpdateAccessDialogParams {
  access: Omit<Access, 'grantee' | 'id'> & {
    grantee?: string | null;
    id: string | null;
  };
}
