import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import type { WorkspaceSettings } from '../../../../lib/workspace';
export class SettingsDto {
 @IsString() @MaxLength(100) agencyName!: string;
 @IsString() @MaxLength(350000) logoDataUrl!: string;
 @IsIn(['light', 'dark', 'system']) theme!: WorkspaceSettings['theme'];
 @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) primaryColor!: string;
 @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) accentColor!: string;
 @IsIn(['operational', 'analytical', 'intelligent']) dashboardType!: WorkspaceSettings['dashboardType'];
}
