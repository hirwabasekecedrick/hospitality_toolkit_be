import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Custom inline cookie-parser middleware to avoid installing external packages
  app.use((req: any, res: any, next: () => void) => {
    const cookieHeader = req.headers?.cookie;
    const cookies: Record<string, string> = {};
    if (cookieHeader) {
      cookieHeader.split(";").forEach((cookie: string) => {
        const parts = cookie.split("=");
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts.slice(1).join("=").trim();
          cookies[name] = decodeURIComponent(value);
        }
      });
    }
    req.cookies = cookies;
    next();
  });

  app.use(helmet());

  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:3001","https://hcardfe.vercel.app"],
    credentials: true,
  });

  app.setGlobalPrefix("api");

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
