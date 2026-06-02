import { IsString } from "class-validator";

export class InitiatePaymentDto {
  @IsString()
  hotelCode: string;
}
