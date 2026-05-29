import { UserWithSettings } from '@ghostfolio/common/types';

import { Role } from '@prisma/client';

export const permissions = {
  accessAdminControl: 'accessAdminControl',
  accessAdminControlBullBoard: 'accessAdminControlBullBoard',
  accessAssistant: 'accessAssistant',
  accessHoldingsChart: 'accessHoldingsChart',
  createAccess: 'createAccess',
  createAccount: 'createAccount',
  createAccountBalance: 'createAccountBalance',
  createActivity: 'createActivity',
  createApiKey: 'createApiKey',
  createMarketData: 'createMarketData',
  createMarketDataOfOwnAssetProfile: 'createMarketDataOfOwnAssetProfile',
  createOwnTag: 'createOwnTag',
  createPlatform: 'createPlatform',
  createTag: 'createTag',
  createUserAccount: 'createUserAccount',
  createRecurringInvestmentPlan: 'createRecurringInvestmentPlan',
  createPriceAlert: 'createPriceAlert',
  createWatchlistItem: 'createWatchlistItem',
  deleteAccess: 'deleteAccess',
  deleteAccount: 'deleteAccount',
  deleteAccountBalance: 'deleteAccountBalance',
  deleteActivity: 'deleteActivity',
  deleteAuthDevice: 'deleteAuthDevice',
  deleteRecurringInvestmentPlan: 'deleteRecurringInvestmentPlan',
  deleteOwnUser: 'deleteOwnUser',
  deletePlatform: 'deletePlatform',
  deleteTag: 'deleteTag',
  deleteUser: 'deleteUser',
  deletePriceAlert: 'deletePriceAlert',
  deleteWatchlistItem: 'deleteWatchlistItem',
  enableAuthGoogle: 'enableAuthGoogle',
  enableAuthOidc: 'enableAuthOidc',
  enableAuthToken: 'enableAuthToken',
  enableDataProviderGhostfolio: 'enableDataProviderGhostfolio',
  enableFearAndGreedIndex: 'enableFearAndGreedIndex',
  enableImport: 'enableImport',
  enableBlog: 'enableBlog',
  enableStatistics: 'enableStatistics',
  enableSubscription: 'enableSubscription',
  enableSubscriptionInterstitial: 'enableSubscriptionInterstitial',
  enableSystemMessage: 'enableSystemMessage',
  impersonateAllUsers: 'impersonateAllUsers',
  readAiPrompt: 'readAiPrompt',
  readMarketData: 'readMarketData',
  readMarketDataOfMarkets: 'readMarketDataOfMarkets',
  readMarketDataOfOwnAssetProfile: 'readMarketDataOfOwnAssetProfile',
  readRecurringInvestmentPlan: 'readRecurringInvestmentPlan',
  readPlatforms: 'readPlatforms',
  readPlatformsWithAccountCount: 'readPlatformsWithAccountCount',
  readTags: 'readTags',
  readPriceAlerts: 'readPriceAlerts',
  readWatchlist: 'readWatchlist',
  reportDataGlitch: 'reportDataGlitch',
  syncDemoUserAccount: 'syncDemoUserAccount',
  toggleReadOnlyMode: 'toggleReadOnlyMode',
  updateAccount: 'updateAccount',
  updateAccess: 'updateAccess',
  updateActivity: 'updateActivity',
  updateAuthDevice: 'updateAuthDevice',
  updateMarketData: 'updateMarketData',
  updateMarketDataOfOwnAssetProfile: 'updateMarketDataOfOwnAssetProfile',
  updateOwnAccessToken: 'updateOwnAccessToken',
  updateRecurringInvestmentPlan: 'updateRecurringInvestmentPlan',
  updatePlatform: 'updatePlatform',
  updateTag: 'updateTag',
  updatePriceAlert: 'updatePriceAlert',
  updateUserSettings: 'updateUserSettings',
  updateViewMode: 'updateViewMode'
} as const;

export function getPermissions(aRole: Role): string[] {
  switch (aRole) {
    case 'ADMIN':
      return [
        permissions.accessAdminControl,
        permissions.accessAssistant,
        permissions.accessHoldingsChart,
        permissions.createAccess,
        permissions.createAccount,
        permissions.createAccountBalance,
        permissions.createActivity,
        permissions.createPriceAlert,
        permissions.createRecurringInvestmentPlan,
        permissions.createWatchlistItem,
        permissions.deleteAccountBalance,
        permissions.deletePriceAlert,
        permissions.deleteRecurringInvestmentPlan,
        permissions.deleteWatchlistItem,
        permissions.createMarketData,
        permissions.createMarketDataOfOwnAssetProfile,
        permissions.createOwnTag,
        permissions.createPlatform,
        permissions.createTag,
        permissions.deleteAccess,
        permissions.deleteAccount,
        permissions.deleteActivity,
        permissions.deleteAuthDevice,
        permissions.deletePlatform,
        permissions.deleteTag,
        permissions.deleteUser,
        permissions.readAiPrompt,
        permissions.readMarketData,
        permissions.readMarketDataOfOwnAssetProfile,
        permissions.readPriceAlerts,
        permissions.readRecurringInvestmentPlan,
        permissions.readPlatforms,
        permissions.readPlatformsWithAccountCount,
        permissions.readTags,
        permissions.readWatchlist,
        permissions.updateAccount,
        permissions.updateAccess,
        permissions.updateActivity,
        permissions.updateAuthDevice,
        permissions.updateMarketData,
        permissions.updateMarketDataOfOwnAssetProfile,
        permissions.updatePriceAlert,
        permissions.updateRecurringInvestmentPlan,
        permissions.updatePlatform,
        permissions.updateTag,
        permissions.updateUserSettings,
        permissions.updateViewMode
      ];

    case 'DEMO':
      return [
        permissions.accessAssistant,
        permissions.accessHoldingsChart,
        permissions.createUserAccount,
        permissions.readAiPrompt,
        permissions.readWatchlist
      ];

    case 'USER':
      return [
        permissions.accessAssistant,
        permissions.accessHoldingsChart,
        permissions.createAccess,
        permissions.createAccount,
        permissions.createAccountBalance,
        permissions.createActivity,
        permissions.createMarketDataOfOwnAssetProfile,
        permissions.createOwnTag,
        permissions.createPriceAlert,
        permissions.createRecurringInvestmentPlan,
        permissions.createWatchlistItem,
        permissions.deleteAccess,
        permissions.deleteAccount,
        permissions.deleteAccountBalance,
        permissions.deleteActivity,
        permissions.deleteAuthDevice,
        permissions.deletePriceAlert,
        permissions.deleteRecurringInvestmentPlan,
        permissions.deleteWatchlistItem,
        permissions.readAiPrompt,
        permissions.readMarketDataOfOwnAssetProfile,
        permissions.readPriceAlerts,
        permissions.readRecurringInvestmentPlan,
        permissions.readPlatforms,
        permissions.readWatchlist,
        permissions.updateAccount,
        permissions.updateAccess,
        permissions.updateActivity,
        permissions.updateAuthDevice,
        permissions.updateMarketDataOfOwnAssetProfile,
        permissions.updatePriceAlert,
        permissions.updateRecurringInvestmentPlan,
        permissions.updateUserSettings,
        permissions.updateViewMode
      ];

    default:
      return [];
  }
}

export function filterGlobalPermissions(
  aGlobalPermissions: string[],
  aUtmSource: 'ios' | 'trusted-web-activity'
) {
  const globalPermissions = aGlobalPermissions;

  if (aUtmSource === 'ios') {
    return globalPermissions.filter((permission) => {
      return (
        permission !== permissions.enableAuthGoogle &&
        permission !== permissions.enableAuthOidc &&
        permission !== permissions.enableSubscription
      );
    });
  } else if (aUtmSource === 'trusted-web-activity') {
    return globalPermissions.filter((permission) => {
      return permission !== permissions.enableSubscription;
    });
  }

  return globalPermissions;
}

export function hasPermission(
  aPermissions: string[] = [],
  aPermission: string
) {
  return aPermissions.includes(aPermission);
}

export function hasReadRestrictedAccessPermission({
  impersonationId,
  user
}: {
  impersonationId: string;
  user: UserWithSettings;
}) {
  if (!impersonationId) {
    return false;
  }

  const access = user?.accessesGet?.find(({ id }) => {
    return id === impersonationId;
  });

  return access?.permissions?.includes('READ_RESTRICTED') ?? true;
}

export function hasRole(aUser: UserWithSettings, aRole: Role) {
  return aUser?.role === aRole;
}

export function isRestrictedView(aUser: UserWithSettings) {
  if (!aUser) {
    return true;
  }

  return aUser?.settings?.settings?.isRestrictedView ?? false;
}
