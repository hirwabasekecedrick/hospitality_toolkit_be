import { IsEmail, IsString, IsOptional, ValidateIf } from "class-validator";
import { IsStrongPassword } from "../../common/validators/strong-password.validator";
import { IsE164Phone, IsCountryCode } from "../../common/validators/phone.validator";
import { Match } from "../../common/validators/match.validator";

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @ValidateIf((o) => o.confirmPassword !== undefined && o.confirmPassword !== "")
  @IsString()
  @Match("password")
  confirmPassword?: string;

  @ValidateIf((o) => !o.fullName)
  @IsString()
  firstName?: string;

  @ValidateIf((o) => !o.fullName)
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsE164Phone()
  phone?: string;

  @IsOptional()
  @IsCountryCode()
  countryCode?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}
