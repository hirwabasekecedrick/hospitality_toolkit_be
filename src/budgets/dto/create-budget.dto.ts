import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateBudgetDto {
  @IsString()
  name: string;

  @IsString()
  allocationType: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsNumber()
  allocated: number;

  @IsOptional()
  @IsNumber()
  ceiling?: number;
}
