import { IsString, MinLength } from "class-validator";

export class ChangeCardPasswordDto {
  @IsString()
  cardId: string;

  @IsString()
  @MinLength(4)
  oldPassword: string;

  @IsString()
  @MinLength(4)
  newPassword: string;
}
