import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
 @Get('ping') ping() { return { ok: true, module: 'vehicles' }; }
}
