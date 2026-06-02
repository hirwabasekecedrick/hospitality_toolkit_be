import { IsOptional, IsEnum, IsNumber, IsString, IsDateString } from "class-validator";
import { CardStatus } from "@prisma/client";

export class UpdateCardDto {
  @IsOptional()
  @IsEnum(CardStatus)
  status?: CardStatus;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
