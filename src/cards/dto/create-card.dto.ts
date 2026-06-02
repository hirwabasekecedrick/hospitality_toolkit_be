import { IsEnum, IsString, MinLength, IsOptional, IsNumber, IsBoolean, IsArray, IsDateString } from "class-validator";
import { CardType, CardValidityType } from "@prisma/client";

export class CreateCardDto {
  @IsEnum(CardType)
  type: CardType;

  @IsString()
  @MinLength(4)
  cardPassword: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsEnum(CardValidityType)
  validityType: CardValidityType;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsBoolean()
  distributed?: boolean;

  @IsOptional()
  @IsString()
  teamLeaderId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsString()
  budgetId?: string;
}
