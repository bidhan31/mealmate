import { Schema, model, Document, Types } from 'mongoose';

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

export interface IEssential extends Document {
  homeId: Types.ObjectId;
  category: EssentialCategory;
  title: string;
  // Wi-Fi fields
  ssid?: string;
  password?: string;
  encryption?: string;
  // Contact fields
  roleTag?: EssentialRoleTag;
  contactPerson?: string;
  phone?: string;
  altPhone?: string;
  whatsapp?: string;
  notes?: string;
  isPinned: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const essentialSchema = new Schema<IEssential>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    category: { type: String, enum: ['wifi', 'contact', 'note'], required: true },
    title: { type: String, required: true, trim: true },
    ssid: { type: String, trim: true },
    password: { type: String, trim: true },
    encryption: { type: String, default: 'WPA', trim: true },
    roleTag: {
      type: String,
      enum: [
        'Landlord',
        'Plumber',
        'Electrician',
        'Gas Supplier',
        'ISP / Internet',
        'House Maid / Cook',
        'Hospital',
        'Pharmacy',
        'Other',
      ],
      default: 'Other',
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    altPhone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    notes: { type: String, trim: true },
    isPinned: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Essential = model<IEssential>('Essential', essentialSchema);
