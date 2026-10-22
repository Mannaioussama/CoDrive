import { Transform, plainToInstance } from 'class-transformer';
import { IsEmail, IsOptional, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { employeeStatuses, equipmentStatuses, roles, type Kind } from '../../../../lib/resources';

const Trim = () => Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value);
class NamedDto {
 @Trim() @IsString() @MinLength(1) @MaxLength(160) name!: string;
}
export class EmployeeDto extends NamedDto {
 @IsIn(roles) role!: string;
 @IsIn(employeeStatuses) status!: string;
 @Trim() @IsString() @MinLength(1) @MaxLength(500) skills!: string;
 @IsInt() @Min(0) @Max(100) load!: number;
 @Trim() @IsString() @MaxLength(254) @ValidateIf((_object, value) => value !== '') @IsEmail() email!: string;
 @Trim() @IsString() @MaxLength(40) phone!: string;
}
export class TaskDto {
 @IsOptional() @IsIn(['À faire', 'En cours', 'Terminée']) progress?: string;
 @Trim() @IsString() @MinLength(1) @MaxLength(160) title!: string;
 @Trim() @IsString() @MinLength(1) @MaxLength(160) client!: string;
 @Trim() @IsString() @MinLength(1) @MaxLength(160) location!: string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
 @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start!: string;
 @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end!: string;
 @Trim() @IsString() @MinLength(1) @MaxLength(160) skill!: string;
 @IsString() @MaxLength(100) employeeId!: string;
 @IsIn(['Proposée', 'Affectée']) status!: string;
}
export class ShiftDto {
 @IsString() @MinLength(1) @MaxLength(100) employeeId!: string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
 @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start!: string;
 @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end!: string;
}
export class EquipmentDto extends NamedDto {
 @Trim() @IsString() @MinLength(1) @MaxLength(160) assignment!: string;
 @IsIn(equipmentStatuses) status!: string;
}
export class StockDto extends NamedDto {
 @IsInt() @Min(0) @Max(1000000000) quantity!: number;
 @IsInt() @Min(0) @Max(1000000000) minimum!: number;
 @Trim() @IsString() @MinLength(1) @MaxLength(40) unit!: string;
}
export const dtoClasses = { employees: EmployeeDto, tasks: TaskDto, shifts: ShiftDto, equipment: EquipmentDto, stock: StockDto };
export function parseKind(value: string): Kind {
 if (!Object.prototype.hasOwnProperty.call(dtoClasses, value)) throw new BadRequestException('Type de ressource inconnu.');
 return value as Kind;
}
export async function validateDto(kind: Kind, value: unknown, partial = false): Promise<Record<string, unknown>> {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Un objet JSON est attendu.');
 // Each resource has its own concrete DTO; unknown properties are rejected.
 const Dto = dtoClasses[kind] as new () => object;
 const instance = plainToInstance(Dto, value);
 const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, skipMissingProperties: partial, validationError: { target: false, value: false } });
 if (errors.length) throw new BadRequestException(errors.flatMap(e => Object.values(e.constraints || {})));
 return Object.fromEntries(Object.entries(instance).filter(([, field]) => !partial || field !== undefined));
}
