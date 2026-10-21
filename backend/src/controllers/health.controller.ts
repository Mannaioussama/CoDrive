import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourcesService } from '../services/resources.service';
@ApiTags('État')
@Controller('health')
export class HealthController {
 constructor(private readonly resources: ResourcesService) {}
 @Get() check() { return this.resources.health(); }
}
