export type MemberStatus = 'pending' | 'active' | 'removed' | 'invited';
export type MemberRole = 'admin' | 'member';

export interface MealSettings {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export type ExpenseCategory = 'independently_counted' | 'equally_shared' | 'individual';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface DisabledSlot {
  _id?: string;
  slot: MealSlot;
  from: string;
  to: string;
}

export interface ExpenseTypeDefinition {
  name: string;
  category: ExpenseCategory;
  defaultAmount: number;
}

export interface HomeDto {
  id: string;
  name: string;
  adminUserId: string;
  mealSettings: MealSettings;
  currentCycle: string;
  timezone: string;
  descoAccountNo?: string | null;
  inviteCode: string;
  expenseTypes?: ExpenseTypeDefinition[];
  closedMealDates?: string[];
  disabledSlots?: DisabledSlot[];
}

export interface MyMembership {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  roomId: string | null;
}

export interface MemberDto {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  roomId: string | null;
  joinedAt: string | null;
  disabledSlots?: DisabledSlot[];
  user: { id: string; name: string; email: string; avatar: string | null; phone?: string | null } | null;
}

export interface RoomDto {
  id: string;
  name: string;
  totalRent: number;
  memberCount: number;
  rentPerMember: number;
}
