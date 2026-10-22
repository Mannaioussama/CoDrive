import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_WORKSPACE, type WorkspaceSettings } from '../../../../lib/workspace';
import { SettingsDto } from './settings.dto';
@Injectable()
export class SettingsService {
 constructor(@InjectModel('WorkspaceSettings') private readonly model: Model<WorkspaceSettings>) {}
 async get(): Promise<WorkspaceSettings> {
  const value = await this.model.findById('agency').select('-_id -__v -createdAt -updatedAt').lean();
  return value ? { ...DEFAULT_WORKSPACE, ...value, dashboardType: String(value.dashboardType) === 'compact' ? 'intelligent' : value.dashboardType } : { ...DEFAULT_WORKSPACE };
 }
 async save(body: unknown): Promise<WorkspaceSettings> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Un objet JSON est attendu.');
  const data = plainToInstance(SettingsDto, body);
  const errors = await validate(data, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
  if (errors.length) throw new BadRequestException('Paramètres invalides : vérifiez les champs, le thème et les couleurs au format #RRGGBB.');
  data.agencyName = data.agencyName.trim();
  if (data.logoDataUrl) {
   const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.logoDataUrl);
   if (!match) throw new BadRequestException('Le logo doit être une image PNG, JPEG ou WebP.');
   const bytes = Buffer.from(match[2], 'base64');
   const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
   if (!valid || bytes.length > 256 * 1024 || bytes.toString('base64') !== match[2]) throw new BadRequestException('Image invalide ou supérieure à 256 Ko après compression.');
  }
  await this.model.findOneAndUpdate({ _id: 'agency' }, { $set: { ...data } }, { upsert: true, runValidators: true });
  return this.get();
 }
}
