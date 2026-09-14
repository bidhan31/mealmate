export type EssentialCategory = 'wifi' | 'contact' | 'note';
export type EssentialRoleTag =
  | 'Landlord'
  | 'Plumber'
  | 'Electrician'
  | 'Gas Supplier'
  | 'ISP / Internet'
  | 'House Maid / Cook'
  | 'Hospital'
  | 'Pharmacy'
  | 'Other';

export interface EssentialDto {
  _id: string;
  homeId: string;
  category: EssentialCategory;
  title: string;
  ssid?: string;
  password?: string;
  encryption?: string;
  roleTag?: EssentialRoleTag;
  contactPerson?: string;
  phone?: string;
  altPhone?: string;
  whatsapp?: string;
  notes?: string;
  isPinned?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEssentialPayload {
  category: EssentialCategory;
  title: string;
  ssid?: string;
  password?: string;
  encryption?: string;
  roleTag?: EssentialRoleTag;
  contactPerson?: string;
  phone?: string;
  altPhone?: string;
  whatsapp?: string;
  notes?: string;
  isPinned?: boolean;
}
