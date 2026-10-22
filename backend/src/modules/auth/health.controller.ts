import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResourcesService } from '../resources/resources.service';
import { Public } from './public.decorator';
@ApiTags('État')
@Controller('health')
export class HealthController {
 constructor(private readonly resources: ResourcesService) {}
 @Public()
 @Get() check() { return this.resources.health(); }
}
