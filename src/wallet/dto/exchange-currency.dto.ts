import { IsNumber, Min, IsPositive } from "class-validator";

export class ExchangeCurrencyDto {
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  usdAmount: number;

  @IsNumber()
  @IsPositive()
  rate: number;
}
