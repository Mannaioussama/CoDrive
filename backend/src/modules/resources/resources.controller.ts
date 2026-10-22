import type { AccessRole } from '../../../../lib/access';
import { AuthService } from '../auth/auth.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { parseKind } from './resource.dto';
import { resourceBody } from './resource.openapi';
import { ResourcesService } from './resources.service';

@ApiTags('Ressources')
@Controller('resources')
export class ResourcesController {
 constructor(private readonly resources: ResourcesService, private readonly auth: AuthService) {}
 @Get() @ApiOperation({ summary: 'Lire toutes les ressources (instantané pour le frontend)' })
 snapshot() { return this.resources.snapshot(); }
 @Get(':kind') @ApiParam({ name: 'kind', enum: ['employees', 'tasks', 'shifts', 'equipment', 'stock'] })
 list(@Param('kind') kind: string) { return this.resources.list(parseKind(kind)); }
 @Get(':kind/:id')
 find(@Param('kind') kind: string, @Param('id') id: string) { return this.resources.find(parseKind(kind), id); }
 @Post(':kind') @ApiBody(resourceBody) @ApiOperation({ summary: 'Créer une ressource ; retourne l’instantané actualisé' })
 async create(@Param('kind') kind: string, @Body() body: unknown) {
  const { accessRole, ...employeeBody } = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const store = await this.resources.create(parseKind(kind), kind === 'employees' ? employeeBody : body, accessRole as AccessRole);
  if (kind !== 'employees') return store;
  const email = (body as { email: string }).email;
  const employee = store.employees.find(e => e.email.trim().toLowerCase() === email.trim().toLowerCase());
  try { return { ...store, invitation: employee ? await this.auth.invite(employee.id) : null }; }
  catch { return { ...store, invitation: null }; }
 }
 @Put(':kind/:id') @ApiBody(resourceBody) @ApiOperation({ summary: 'Remplacer une ressource ; retourne l’instantané actualisé' })
 update(@Param('kind') kind: string, @Param('id') id: string, @Body() body: unknown) { return this.resources.update(parseKind(kind), id, body); }
 @Patch(':kind/:id') @ApiBody(resourceBody) @ApiOperation({ summary: 'Modifier certains champs ; retourne l’instantané actualisé' })
 patch(@Param('kind') kind: string, @Param('id') id: string, @Body() body: unknown) { return this.resources.update(parseKind(kind), id, body, true); }
 @Delete(':kind/:id') @ApiOperation({ summary: 'Supprimer une ressource ; retourne l’instantané actualisé' })
 remove(@Param('kind') kind: string, @Param('id') id: string) { return this.resources.remove(parseKind(kind), id); }
}
