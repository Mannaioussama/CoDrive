import { Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResourcesService } from '../services/resources.service';
@ApiTags('Affectations')
@Controller('assignments')
export class AssignmentsController {
 constructor(private readonly resources: ResourcesService) {}
 @Post('auto') @ApiOperation({ summary: 'Affecter toutes les propositions compatibles dans une transaction' })
 auto() { return this.resources.assignAll(); }
 @Post(':id') @ApiOperation({ summary: 'Confirmer la recommandation recalculée côté serveur' })
 assign(@Param('id') id: string) { return this.resources.assign(id); }
}
