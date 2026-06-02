import { IsString, IsOptional } from "class-validator";

export class ResolveDisputeDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
