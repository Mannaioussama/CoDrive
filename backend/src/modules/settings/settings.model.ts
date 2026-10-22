import { Schema } from 'mongoose';
import { DEFAULT_WORKSPACE } from '../../../../lib/workspace';
export const SettingsSchema = new Schema({
 _id: { type: String }, agencyName: { type: String, default: '', maxlength: 100 }, logoDataUrl: { type: String, default: '' },
 theme: { type: String, enum: ['light', 'dark', 'system'], default: DEFAULT_WORKSPACE.theme },
 primaryColor: { type: String, required: true }, accentColor: { type: String, required: true },
 dashboardType: { type: String, enum: ['operational', 'analytical', 'intelligent'], default: DEFAULT_WORKSPACE.dashboardType },
}, { timestamps: true, strict: 'throw' });
