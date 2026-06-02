import { Controller, Post, Get, Body, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

function setAuthCookies(res: Response, accessToken: string, csrfToken: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400 * 1000,
  });
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400 * 1000,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("csrf_token", { path: "/" });
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip;
    const result = await this.authService.register(dto, ip);
    setAuthCookies(res, result.accessToken, result.csrfToken);
    return {
      csrfToken: result.csrfToken,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip;
    const result = await this.authService.login(dto.email, dto.password, ip);
    setAuthCookies(res, result.accessToken, result.csrfToken);
    return {
      csrfToken: result.csrfToken,
      user: result.user,
    };
  }

  @Public()
  @Post("logout")
  async logout(@CurrentUser() user: any, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.access_token || req.headers?.authorization?.replace("Bearer ", "");
    let jti: string | undefined;
    if (token) {
      try {
        const decoded = this.authService["jwtService"].decode(token) as any;
        jti = decoded?.jti;
      } catch {}
    }
    clearAuthCookies(res);
    return this.authService.logout(jti);
  }

  @Get("me")
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @Get("csrf")
  async refreshCsrf(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    const csrfToken = require("crypto").randomBytes(32).toString("hex");
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("csrf_token", csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400 * 1000,
    });
    return { csrfToken };
  }
}
