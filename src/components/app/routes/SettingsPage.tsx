import { ProfileSettings } from "./settings/ProfileSettings";
import { TwoFactorSettings } from "./settings/TwoFactorSettings";
import { OrgMembers } from "./settings/OrgMembers";

export const SettingsPage = () => (
  <div class="mx-auto flex max-w-2xl flex-col gap-6">
    <h1 class="text-2xl font-bold">Settings</h1>
    <ProfileSettings />
    <TwoFactorSettings />
    <OrgMembers />
  </div>
);
