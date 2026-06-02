import { IsString, IsNumber, IsOptional, Min } from "class-validator";

export class CreateDisputeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
