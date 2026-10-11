declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OWNER_ACCOUNT_ID?: string;
    OWNER_USERNAME?: string;
    OWNER_PASSWORD_HASH?: string;
  }
}
