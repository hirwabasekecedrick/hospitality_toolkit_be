import { IsString, IsNumber, Min } from "class-validator";

export class ConfirmPaymentDto {
  @IsString()
  hotelCode: string;

  @IsString()
  cardId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  cardPassword: string;
}
