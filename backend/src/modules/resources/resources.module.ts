import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResourcesController } from './resources.controller';
import { AssignmentsController } from './assignments.controller';
import { ResourcesService } from './resources.service';
import { modelDefinitions } from './resource.models';
import { AuthModule } from '../auth/auth.module';

@Module({
 imports: [
  MongooseModule.forFeature([...modelDefinitions]),
  forwardRef(() => AuthModule),
 ],
 controllers: [ResourcesController, AssignmentsController],
 providers: [ResourcesService],
 exports: [ResourcesService],
})
export class ResourcesModule {}
