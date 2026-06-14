export interface MembershipWindow {
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export function isMemberAt(
  membership: MembershipWindow,
  eventDate: Date,
): boolean {
  const eventTime = eventDate.getTime();
  return (
    membership.joinedAt.getTime() <= eventTime &&
    (membership.leftAt === null || eventTime < membership.leftAt.getTime())
  );
}

export function hasActiveMembership(
  memberships: readonly MembershipWindow[],
  userId: string,
  eventDate: Date,
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId && isMemberAt(membership, eventDate),
  );
}
