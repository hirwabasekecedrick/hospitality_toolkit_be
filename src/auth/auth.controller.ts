import { Controller, Post, Get, Body, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

function cookieOptions(maxAgeMs: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, csrfToken: string) {
  res.cookie("access_token", accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie("refresh_token", refreshToken, cookieOptions(7 * 86400 * 1000));
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.clearCookie("csrf_token", { path: "/" });
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto, req.ip, req.headers["user-agent"]);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken);
    return {
      csrfToken: result.csrfToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      verificationToken: result.verificationToken,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password, {
      deviceName: dto.deviceName,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken);
    return {
      csrfToken: result.csrfToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken =
      req.cookies?.refresh_token ||
      (req.body?.refreshToken as string | undefined);
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token required");
    }
    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken);
    return {
      csrfToken: result.csrfToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Public()
  @Post("verify-email")
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.access_token || req.headers?.authorization?.replace("Bearer ", "");
    let jti: string | undefined;
    if (token) {
      try {
        const decoded = this.authService["jwtService"].decode(token) as { jti?: string };
        jti = decoded?.jti;
      } catch {
        /* ignore */
      }
    }
    const refreshToken = req.cookies?.refresh_token || (req.body?.refreshToken as string | undefined);
    clearAuthCookies(res);
    return this.authService.logout(jti, refreshToken);
  }

  @Get("me")
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @Get("csrf")
  async refreshCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = require("crypto").randomBytes(32).toString("hex");
    res.cookie("csrf_token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400 * 1000,
    });
    return { csrfToken };
  }
}
