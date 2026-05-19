import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('hrm/holidays')
@UseGuards(JwtAuthGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return this.holidayService.findAll(user.tenantId, year);
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateHolidayDto,
  ) {
    return this.holidayService.create(user.tenantId, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.holidayService.remove(user.tenantId, id);
  }
}
