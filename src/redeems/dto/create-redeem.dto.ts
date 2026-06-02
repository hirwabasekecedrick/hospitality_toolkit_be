import { IsString, IsOptional } from "class-validator";

export class CreateRedeemDto {
  @IsString()
  title: string;

  @IsString()
  schedule: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
