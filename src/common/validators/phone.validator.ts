import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

@ValidatorConstraint({ name: "isE164Phone", async: false })
export class IsE164PhoneConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return typeof value === "string" && PHONE_E164.test(value);
  }

  defaultMessage(): string {
    return "Phone must be in E.164 format (e.g. +250788123456)";
  }
}

export function IsE164Phone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsE164PhoneConstraint,
    });
  };
}

const COUNTRY_CODE = /^\+[1-9]\d{0,3}$/;

@ValidatorConstraint({ name: "isCountryCode", async: false })
export class IsCountryCodeConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return typeof value === "string" && COUNTRY_CODE.test(value);
  }

  defaultMessage(): string {
    return "Country code must be a valid dial code (e.g. +250)";
  }
}

export function IsCountryCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCountryCodeConstraint,
    });
  };
}
