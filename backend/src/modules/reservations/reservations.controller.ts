import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
 @Get('ping') ping() { return { ok: true, module: 'reservations' }; }
}
