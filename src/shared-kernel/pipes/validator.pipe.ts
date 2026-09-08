import { Injectable } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';

@Injectable()
export class AppValidationPipe extends ZodValidationPipe {}
