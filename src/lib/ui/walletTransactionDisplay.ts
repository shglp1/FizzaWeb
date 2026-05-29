/** Format admin actor for wallet transaction history (Finance/Ops UI). */
export function formatWalletTransactionAdmin(tx: {
  adminUserId?: string | null;
  adminUser?: {
    id: string;
    fullName: string;
    user?: { email: string | null } | null;
  } | null;
}): string | null {
  if (!tx.adminUserId && !tx.adminUser) return null;

  const profile = tx.adminUser;
  if (profile?.fullName && profile.user?.email) {
    return `${profile.fullName} (${profile.user.email})`;
  }
  if (profile?.fullName) return profile.fullName;
  if (profile?.user?.email) return profile.user.email;
  return tx.adminUserId ?? profile?.id ?? null;
}
