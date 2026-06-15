import { IsNumber, Min, IsPositive } from "class-validator";

export class DepositCardDto {
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;
}
