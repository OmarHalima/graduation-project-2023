declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module "https://deno.land/x/smtp@v0.7.0/mod.ts" {
  export class SmtpClient {
    constructor();
    connect(config: {
      hostname: string;
      port: number;
      username: string;
      password: string;
    }): Promise<void>;
    send(options: {
      from: string;
      to: string;
      subject: string;
      content: string;
      html: string;
    }): Promise<void>;
    close(): Promise<void>;
  }
}