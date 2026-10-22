import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('complaints')
@Controller('complaints')
export class ComplaintsController {
 @Get('ping') ping() { return { ok: true, module: 'complaints' }; }
}
